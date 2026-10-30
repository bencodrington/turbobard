import { githubFromEnvironment } from '../build/github.ts'

const github = githubFromEnvironment()
const {
  SOURCE_SHA,
  BUILD_ID,
  ARTIFACT_ID,
  ARTIFACT_DIGEST,
  GITHUB_RUN_ATTEMPT,
} = process.env
if (
  !SOURCE_SHA ||
  !BUILD_ID ||
  !ARTIFACT_ID ||
  !ARTIFACT_DIGEST ||
  !GITHUB_RUN_ATTEMPT
) {
  throw new Error('Missing staging identity')
}
// Written only after Wrangler succeeds. This durable receipt also handles staging-only retries.
const deployment = await github.request<{ id: number }>('deployments', 'POST', {
  ref: SOURCE_SHA,
  environment: 'staging',
  auto_merge: false,
  required_contexts: [],
  production_environment: false,
  payload: {
    kind: 'turbobard-staging',
    buildId: BUILD_ID,
    sourceSha: SOURCE_SHA,
    artifactId: ARTIFACT_ID,
    artifactDigest: ARTIFACT_DIGEST,
    stagingAttempt: GITHUB_RUN_ATTEMPT,
  },
})
await github.request(`deployments/${deployment.id}/statuses`, 'POST', {
  state: 'success',
  auto_inactive: false,
  description: `Staged build ${BUILD_ID}`,
})
