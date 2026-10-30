// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { GitHub } from './github'
import { preparePublication } from './publish'
import { assertForward, compareVersions, nextVersion } from './release'
import type { Deployment, Publication } from './release'

const archive = new TextEncoder().encode('exact verified output')
const digest = createHash('sha256').update(archive).digest('hex')
const sha = 'a'.repeat(40)
const identity = {
  buildId: '123.2',
  sourceSha: sha,
  artifactId: '456',
  artifactDigest: digest,
}
const options = { buildId: '123.2', intent: '789', version: '', notes: '' }

class FakeGitHub extends GitHub {
  events: string[] = []
  deployments: Deployment[] = []
  releases: {
    id: number
    tag_name: string
    target_commitish: string
    draft: boolean
    prerelease: boolean
    immutable: boolean
    body: string
  }[] = []
  assets: { id: number; name: string; bytes: Uint8Array }[] = []
  expired = false
  corrupted = false
  staged = true
  verified = true
  branch = 'main'
  event = 'push'
  stagingJobPassed = true
  failUpload = false
  failAfterPublication = false
  immutable = true
  tagSha = sha
  tags: { name: string }[] = []

  constructor() {
    super('owner/repo', 'fake')
  }

  override async request<T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    return (await this.fakeRequest(path, method, body)) as T
  }

  private async fakeRequest(path: string, method: string, body?: unknown) {
    this.events.push(`${method} ${path}`)
    if (path === 'actions/runs/123')
      return { workflow_id: 1, head_branch: this.branch, event: this.event }
    if (path === 'actions/workflows/verify.yml') return { id: 1 }
    if (path === 'git/refs' && method === 'POST') {
      const ref = (body as { ref: string }).ref
      this.tags.push({ name: ref.replace('refs/tags/', '') })
      return {}
    }
    if (path.includes('/attempts/2/jobs'))
      return {
        jobs: [
          { name: 'verify', conclusion: this.verified ? 'success' : 'failure' },
        ],
      }
    if (path.includes('/attempts/3/jobs'))
      return {
        jobs: [
          {
            name: 'staging',
            conclusion: this.stagingJobPassed ? 'success' : 'failure',
          },
        ],
      }
    if (path === 'actions/artifacts/456')
      return {
        id: 456,
        name: 'build-123.2',
        expired: this.expired,
        digest: `sha256:${digest}`,
        workflow_run: { id: 123 },
      }
    if (path === 'deployments' && method === 'POST') {
      const value = body as {
        ref: string
        payload: Deployment['payload']
        environment: string
      }
      const deployment = {
        id: this.deployments.length + 10,
        sha: value.ref,
        payload: value.payload,
        environment: value.environment,
      }
      this.deployments.push(deployment)
      return deployment
    }
    if (path.startsWith('deployments/') && method === 'POST') return {}
    if (path === 'releases/generate-notes') return { body: 'Generated notes' }
    if (path === 'releases' && method === 'POST') {
      const release = {
        ...(body as (typeof this.releases)[number]),
        id: 50,
        immutable: false,
      }
      this.releases.push(release)
      return release
    }
    if (path === 'releases/50' && method === 'PATCH') {
      this.releases[0].draft = false
      this.releases[0].immutable = this.immutable
      if (this.failAfterPublication)
        throw new Error('Response lost after publication')
      return this.releases[0]
    }
    if (path.startsWith('git/ref/tags/'))
      return { object: { type: 'commit', sha: this.tagSha } }
    throw new Error(`Unexpected request: ${method} ${path}`)
  }

  override async list<T>(path: string): Promise<T[]> {
    let result: unknown[]
    if (path === 'deployments?environment=staging')
      result = this.staged
        ? [
            {
              id: 1,
              sha,
              payload: {
                ...identity,
                kind: 'turbobard-staging',
                stagingAttempt: '3',
              },
            },
          ]
        : []
    else if (path === 'deployments/1/statuses') result = [{ state: 'success' }]
    else if (path === 'deployments?environment=production-publication')
      result = this.deployments.filter(
        ({ payload }) => payload.kind === 'turbobard-publication',
      )
    else if (path === 'deployments?environment=production')
      result = this.deployments.filter(
        ({ payload }) => payload.kind === 'turbobard-production',
      )
    else if (path === 'releases') result = this.releases
    else if (path === 'tags') result = this.tags
    else if (path === 'releases/50/assets') result = this.assets
    else throw new Error(`Unexpected list: ${path}`)
    return result as T[]
  }

  override async bytes(path: string) {
    if (path === 'actions/artifacts/456/zip')
      return this.corrupted ? new Uint8Array([0]) : archive
    const asset = this.assets.find(
      (item) => path === `releases/assets/${item.id}`,
    )
    if (!asset) throw new Error(`Unexpected download ${path}`)
    return asset.bytes
  }

  override async upload(releaseId: number, name: string, bytes: Uint8Array) {
    this.events.push(`UPLOAD ${name}`)
    if (this.failUpload && name === 'build.zip')
      throw new Error('Upload failed')
    this.assets.push({ id: this.assets.length + 1, name, bytes })
  }
}

const files = { assertOnMain: () => {}, inspectArchive: async () => {} }

describe('publication protocol', () => {
  it('promotes the exact verified attempt after a staging-only retry, pinning the source and both assets', async () => {
    const github = new FakeGitHub()
    const result = await preparePublication(github, options, files)
    expect(result.publication).toEqual({
      schema: 1,
      ...identity,
      intent: '789',
      version: 'v0.1.0',
    })
    expect(github.releases[0]).toMatchObject({
      draft: false,
      immutable: true,
      target_commitish: sha,
    })
    expect(github.assets.map((asset) => asset.name)).toEqual([
      'publication.json',
      'build.zip',
    ])
    expect(github.events.indexOf('UPLOAD build.zip')).toBeLessThan(
      github.events.indexOf('PATCH releases/50'),
    )
    expect(github.deployments.at(-1)?.payload.kind).toBe('turbobard-production')
  })

  it.each([
    'expired',
    'corrupted',
    'staged',
    'verified',
    'stagingJobPassed',
    'branch',
    'event',
  ] as const)(
    'blocks ineligible builds before reserving or publishing: %s',
    async (field) => {
      const github = new FakeGitHub()
      if (field === 'branch') github.branch = 'feature'
      else if (field === 'event') github.event = 'pull_request'
      else github[field] = ['expired', 'corrupted'].includes(field)
      await expect(preparePublication(github, options, files)).rejects.toThrow()
      expect(github.deployments).toHaveLength(0)
      expect(github.releases).toHaveLength(0)
    },
  )

  it('blocks non-main source and embedded identity failure before publication', async () => {
    for (const failing of ['assertOnMain', 'inspectArchive'] as const) {
      const github = new FakeGitHub()
      await expect(
        preparePublication(github, options, {
          ...files,
          [failing]: () => {
            throw new Error('Identity failure')
          },
        }),
      ).rejects.toThrow('Identity failure')
      expect(github.releases).toHaveLength(0)
    }
  })

  it('resumes a partial draft upload with the reserved automatic version', async () => {
    const github = new FakeGitHub()
    github.failUpload = true
    await expect(preparePublication(github, options, files)).rejects.toThrow(
      'Upload failed',
    )
    github.failUpload = false
    const result = await preparePublication(github, options, files)
    expect(result.publication.version).toBe('v0.1.0')
    expect(github.releases).toHaveLength(1)
    expect(github.assets).toHaveLength(2)
  })

  it('recovers a lost publish response without publishing again or consuming another version', async () => {
    const github = new FakeGitHub()
    github.failAfterPublication = true
    await expect(preparePublication(github, options, files)).rejects.toThrow(
      'Response lost',
    )
    github.failAfterPublication = false
    github.releases[0].body = 'Owner edited the release notes'
    const result = await preparePublication(github, options, files)
    expect(result.publication.version).toBe('v0.1.0')
    expect(
      github.events.filter((event) => event === 'PATCH releases/50'),
    ).toHaveLength(1)
  })

  it('rejects retry identity changes, even if the source has another checked build', async () => {
    const github = new FakeGitHub()
    await preparePublication(github, options, files)
    await expect(
      preparePublication(github, { ...options, version: 'v0.2.0' }, files),
    ).rejects.toThrow('Retry cannot change')
    const intent = github.deployments.find(
      ({ payload }) => payload.kind === 'turbobard-publication',
    )!
    intent.payload.artifactId = '999'
    await expect(preparePublication(github, options, files)).rejects.toThrow(
      'intent/build mismatch',
    )
  })

  it('blocks old retries after a higher production attempt, including ambiguous failures', async () => {
    const github = new FakeGitHub()
    await preparePublication(github, options, files)
    github.deployments.push({
      id: 99,
      sha,
      payload: {
        schema: 1,
        ...identity,
        intent: '900',
        version: 'v0.1.1',
        kind: 'turbobard-production',
      },
    })
    const count = github.deployments.length
    await expect(preparePublication(github, options, files)).rejects.toThrow(
      'newer production version',
    )
    expect(github.deployments).toHaveLength(count)
  })

  it('rejects altered release assets on retry', async () => {
    const github = new FakeGitHub()
    await preparePublication(github, options, files)
    github.assets.find((asset) => asset.name === 'build.zip')!.bytes =
      new Uint8Array([0])
    await expect(preparePublication(github, options, files)).rejects.toThrow(
      'SHA-256 mismatch',
    )
  })

  it('never deploys a mutable release or an incorrectly pinned tag', async () => {
    for (const field of ['immutable', 'tagSha'] as const) {
      const github = new FakeGitHub()
      if (field === 'immutable') github.immutable = false
      else github.tagSha = 'b'.repeat(40)
      await expect(preparePublication(github, options, files)).rejects.toThrow()
      expect(
        github.deployments.some(
          ({ payload }) => payload.kind === 'turbobard-production',
        ),
      ).toBe(false)
      if (field === 'tagSha') {
        expect(github.events).not.toContain('PATCH releases/50')
      }
    }
  })
})

describe('version policy', () => {
  it('compares numeric components and reserves all numbered versions, including drafts and intents', () => {
    expect(nextVersion([])).toBe('v0.1.0')
    expect(nextVersion(['v0.1.9', 'v0.1.10', 'unrelated'])).toBe('v0.1.11')
    expect(compareVersions('v2.0.0', 'v10.0.0')).toBe(-1)
    expect(() => compareVersions('v01.0.0', 'v1.0.0')).toThrow()
    expect(() => compareVersions('v1.0.0-rc.1', 'v1.0.0')).toThrow()
  })

  it('allows the same publication to retry, but forbids reusing its version for another build', () => {
    const publication: Publication = {
      schema: 1,
      ...identity,
      intent: '789',
      version: 'v0.1.0',
    }
    const deployment = {
      id: 1,
      sha,
      payload: { ...publication, kind: 'turbobard-production' },
    }
    expect(() => assertForward(publication, [deployment])).not.toThrow()
    expect(() =>
      assertForward({ ...publication, buildId: '123.3' }, [deployment]),
    ).toThrow('another publication')
  })
})
