import { verifyArchive, verifyArtifact, verifyBuildInfo } from './artifact.ts'
import {
  assertForward,
  assertPublication,
  compareVersions,
  nextVersion,
  versionParts,
} from './release.ts'
import type { BuildIdentity, Deployment, Publication } from './release.ts'
import type { GitHub } from './github.ts'

interface Asset {
  id: number
  name: string
}
interface Release {
  id: number
  tag_name: string
  target_commitish: string
  draft: boolean
  prerelease: boolean
  immutable: boolean
  body: string
}
interface Receipt extends Deployment {
  payload: Deployment['payload'] & { stagingAttempt?: string }
}

interface Jobs {
  jobs: { name: string; conclusion: string }[]
}
interface GitObject {
  type: string
  sha: string
}

export interface PublishOptions {
  buildId: string
  intent: string
  version: string
  notes: string
}

// GitHub is injected so the publication/retry protocol can be exercised without publishing.
export async function preparePublication(
  github: GitHub,
  options: PublishOptions,
  files: {
    assertOnMain: (sha: string) => void
    inspectArchive: (
      archive: Uint8Array,
      identity: BuildIdentity,
    ) => Promise<void>
  },
) {
  if (
    !/^[1-9]\d*\.[1-9]\d*$/.test(options.buildId) ||
    !/^[1-9]\d*$/.test(options.intent)
  ) {
    throw new Error('Select the exact runId.attempt build ID')
  }
  const [runId, attempt] = options.buildId.split('.')
  const run = await github.request<{
    workflow_id: number
    head_branch: string
    event: string
  }>(`actions/runs/${runId}`)
  const workflow = await github.request<{ id: number }>(
    'actions/workflows/verify.yml',
  )
  if (
    run.workflow_id !== workflow.id ||
    run.head_branch !== 'main' ||
    !['push', 'workflow_dispatch'].includes(run.event)
  )
    throw new Error('Build must come from Verify on main')
  const jobs = await github.request<Jobs>(
    `actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
  )
  if (
    !jobs.jobs.some(
      (job: { name: string; conclusion: string }) =>
        job.name === 'verify' && job.conclusion === 'success',
    )
  ) {
    throw new Error('Selected verification attempt did not pass')
  }
  const receipts = await github.list<Receipt>('deployments?environment=staging')
  let identity: BuildIdentity | undefined
  for (const receipt of receipts) {
    const payload = receipt.payload
    if (
      payload.kind !== 'turbobard-staging' ||
      payload.buildId !== options.buildId
    )
      continue
    const statuses = await github.list<{ state: string }>(
      `deployments/${receipt.id}/statuses`,
    )
    if (!statuses.some((status) => status.state === 'success')) continue
    if (!/^[1-9]\d*$/.test(payload.stagingAttempt ?? '')) continue
    const stagedJobs = await github.request<Jobs>(
      `actions/runs/${runId}/attempts/${payload.stagingAttempt}/jobs?per_page=100`,
    )
    if (
      !stagedJobs.jobs.some(
        (job: { name: string; conclusion: string }) =>
          job.name === 'staging' && job.conclusion === 'success',
      )
    )
      continue
    if (
      !payload.sourceSha ||
      receipt.sha !== payload.sourceSha ||
      !/^[a-f0-9]{40}$/.test(payload.sourceSha) ||
      !payload.artifactId ||
      !/^[1-9]\d*$/.test(payload.artifactId) ||
      !payload.artifactDigest
    ) {
      throw new Error('Malformed staging receipt')
    }
    identity = {
      buildId: options.buildId,
      sourceSha: payload.sourceSha,
      artifactId: payload.artifactId,
      artifactDigest: payload.artifactDigest,
    }
    break
  }
  if (!identity)
    throw new Error(
      'No successful staging receipt for that exact build; restage and personally check it',
    )
  files.assertOnMain(identity.sourceSha)
  const artifactPath = `actions/artifacts/${identity.artifactId}`
  verifyArtifact(await github.request(artifactPath), {
    id: identity.artifactId,
    buildId: identity.buildId,
    digest: identity.artifactDigest,
  })
  const archive = await github.bytes(`${artifactPath}/zip`)
  verifyArchive(archive, identity.artifactDigest)
  await files.inspectArchive(archive, identity)

  const intents = await github.list<Deployment>(
    'deployments?environment=production-publication',
  )
  const matching = intents.filter(
    ({ payload }) =>
      payload.kind === 'turbobard-publication' &&
      payload.intent === options.intent,
  )
  if (matching.length > 1) throw new Error('Ambiguous publication intent')
  const releases = await github.list<Release>('releases')
  const tags = await github.list<{ name: string }>('tags')
  const used = [
    ...releases.map((release) => release.tag_name),
    ...tags.map((tag) => tag.name),
    ...intents.flatMap(({ payload }) =>
      payload.version ? [payload.version] : [],
    ),
  ]
  let publication: Publication
  if (matching.length) {
    const saved = matching[0].payload as Publication
    assertPublication(saved, identity, options.intent)
    publication = {
      schema: 1,
      ...identity,
      intent: options.intent,
      version: saved.version,
    }
    if (options.version && options.version !== publication.version)
      throw new Error('Retry cannot change its version')
  } else {
    const version = options.version || nextVersion(used)
    versionParts(version)
    if (
      used.includes(version) ||
      used.some((tag) => {
        try {
          return compareVersions(version, tag) <= 0
        } catch {
          return false
        }
      })
    )
      throw new Error(
        'Version must be unused and higher than all reserved releases/tags',
      )
    publication = { schema: 1, ...identity, intent: options.intent, version }
  }
  // The caller holds cloudflare-production throughout validation, publication and deployment.
  assertForward(
    publication,
    await github.list<Deployment>('deployments?environment=production'),
  )
  if (!matching.length) {
    await github.request('deployments', 'POST', {
      ref: identity.sourceSha,
      environment: 'production-publication',
      auto_merge: false,
      required_contexts: [],
      production_environment: false,
      payload: { ...publication, kind: 'turbobard-publication' },
    })
  }
  // Create/validate the exact tag before publication. A lost tag-creation response
  // is recoverable because the durable intent already reserved this version.
  if (!tags.some((tag) => tag.name === publication.version)) {
    await github.request('git/refs', 'POST', {
      ref: `refs/tags/${publication.version}`,
      sha: identity.sourceSha,
    })
  }
  async function assertTagSource(expectedSha: string) {
    const tag = await github.request<{ object: GitObject }>(
      `git/ref/tags/${publication.version}`,
    )
    let object = tag.object
    while (object.type === 'tag') {
      object = (
        await github.request<{ object: GitObject }>(`git/tags/${object.sha}`)
      ).object
    }
    if (object.type !== 'commit' || object.sha !== expectedSha) {
      throw new Error('Release tag is not pinned to the selected source')
    }
  }
  await assertTagSource(identity.sourceSha)
  const marker = `<!-- turbobard-publication:${options.intent} -->`
  let release = releases.find(
    (release) => release.tag_name === publication.version,
  )
  if (!release) {
    const notes =
      options.notes ||
      (
        await github.request<{ body: string }>(
          'releases/generate-notes',
          'POST',
          {
            tag_name: publication.version,
            target_commitish: identity.sourceSha,
          },
        )
      ).body
    release = (await github.request('releases', 'POST', {
      tag_name: publication.version,
      target_commitish: identity.sourceSha,
      name: publication.version,
      body: `${notes}\n\n${marker}`,
      draft: true,
      prerelease: false,
    })) as Release
  }
  if (release.prerelease || release.target_commitish !== identity.sourceSha)
    throw new Error('Release source/type mismatch')
  const manifest = new TextEncoder().encode(
    JSON.stringify(publication, null, 2) + '\n',
  )
  let assets = await github.list<Asset>(`releases/${release.id}/assets`)
  const savedManifest = assets.find(
    (asset) => asset.name === 'publication.json',
  )
  if (savedManifest) {
    const saved = JSON.parse(
      new TextDecoder().decode(
        await github.bytes(`releases/assets/${savedManifest.id}`),
      ),
    ) as Publication
    assertPublication(saved, identity, options.intent)
    if (saved.version !== publication.version)
      throw new Error('Release manifest version mismatch')
  } else {
    if (!release.draft || !release.body.includes(marker))
      throw new Error('Release lacks this publication identity')
    await github.upload(release.id, 'publication.json', manifest)
  }
  const savedArchive = assets.find((asset) => asset.name === 'build.zip')
  if (savedArchive)
    verifyArchive(
      await github.bytes(`releases/assets/${savedArchive.id}`),
      identity.artifactDigest,
    )
  else {
    if (!release.draft)
      throw new Error('Published release is missing build.zip')
    await github.upload(release.id, 'build.zip', archive)
  }
  // Re-read every attached asset before irreversible publication, including completed retry uploads.
  assets = await github.list<Asset>(`releases/${release.id}/assets`)
  if (assets.length !== 2)
    throw new Error(
      'Release must contain exactly build.zip and publication.json',
    )
  for (const asset of assets) {
    const bytes = await github.bytes(`releases/assets/${asset.id}`)
    if (asset.name === 'build.zip')
      verifyArchive(bytes, identity.artifactDigest)
    else if (asset.name === 'publication.json') {
      if (
        new TextDecoder().decode(bytes) !== new TextDecoder().decode(manifest)
      )
        throw new Error('Release manifest bytes differ')
    } else throw new Error('Unexpected release asset')
  }
  if (release.draft)
    release = (await github.request(`releases/${release.id}`, 'PATCH', {
      draft: false,
      make_latest: 'true',
    })) as Release
  if (!release.immutable)
    throw new Error(
      'Release is not immutable; enable repository release immutability before publishing',
    )
  await assertTagSource(identity.sourceSha)
  // Persist the high-water mark BEFORE touching Cloudflare. Ambiguous failures cannot allow older code to overwrite it.
  const deployment = await github.request<{ id: number }>(
    'deployments',
    'POST',
    {
      ref: identity.sourceSha,
      environment: 'production',
      auto_merge: false,
      required_contexts: [],
      production_environment: true,
      payload: { ...publication, kind: 'turbobard-production' },
    },
  )
  await github.request(`deployments/${deployment.id}/statuses`, 'POST', {
    state: 'in_progress',
    auto_inactive: false,
  })
  return { publication, deploymentId: deployment.id as number }
}

export { verifyBuildInfo }
