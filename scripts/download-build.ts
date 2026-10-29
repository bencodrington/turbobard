import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { verifyArchive, verifyArtifact } from '../build/artifact.ts'

const {
  ARTIFACT_ID,
  ARTIFACT_DIGEST,
  BUILD_ID,
  GH_TOKEN,
  GITHUB_REPOSITORY,
  RUNNER_TEMP,
} = process.env
if (
  !ARTIFACT_ID ||
  !ARTIFACT_DIGEST ||
  !BUILD_ID ||
  !GH_TOKEN ||
  !GITHUB_REPOSITORY ||
  !RUNNER_TEMP ||
  !/^[1-9]\d*$/.test(ARTIFACT_ID)
) {
  throw new Error('Missing artifact identity or GitHub download configuration')
}

const endpoint = `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/artifacts/${ARTIFACT_ID}`
const headers = {
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}
const metadata = await fetch(endpoint, {
  headers,
  signal: AbortSignal.timeout(60_000),
})
if (!metadata.ok)
  throw new Error(
    `Artifact lookup failed (${metadata.status}); restage if expired`,
  )
verifyArtifact(await metadata.json(), {
  id: ARTIFACT_ID,
  buildId: BUILD_ID,
  digest: ARTIFACT_DIGEST,
})
const response = await fetch(`${endpoint}/zip`, {
  headers,
  signal: AbortSignal.timeout(60_000),
})
if (!response.ok)
  throw new Error(`Artifact download failed (${response.status})`)
const archive = new Uint8Array(await response.arrayBuffer())
verifyArchive(archive, ARTIFACT_DIGEST)
await writeFile(join(RUNNER_TEMP, 'build.zip'), archive)
