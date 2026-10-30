import { execFileSync } from 'node:child_process'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { githubFromEnvironment } from '../build/github.ts'
import { preparePublication, verifyBuildInfo } from '../build/publish.ts'

if (
  process.env.GITHUB_REF !== 'refs/heads/main' ||
  process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
) {
  throw new Error(
    'Production publication must be manually dispatched from main',
  )
}
const temp = process.env.RUNNER_TEMP
if (!temp || !process.env.GITHUB_OUTPUT || !process.env.GITHUB_STEP_SUMMARY)
  throw new Error('Missing Actions paths')
const result = await preparePublication(
  githubFromEnvironment(),
  {
    buildId: process.env.BUILD_ID ?? '',
    intent: process.env.GITHUB_RUN_ID ?? '',
    version: process.env.RELEASE_VERSION ?? '',
    notes: process.env.RELEASE_NOTES ?? '',
  },
  {
    assertOnMain(sha) {
      execFileSync('git', ['fetch', 'origin', 'main'], { stdio: 'inherit' })
      execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'])
    },
    async inspectArchive(archive, identity) {
      const path = join(temp, 'build.zip')
      await writeFile(path, archive)
      // Only extract the validated artifact, into a fresh directory. There is no build command.
      execFileSync('mkdir', ['dist'])
      execFileSync('unzip', ['-q', path, '-d', 'dist'])
      verifyBuildInfo(
        JSON.parse(await readFile('dist/build-info.json', 'utf8')),
        { commit: identity.sourceSha, buildId: identity.buildId },
      )
    },
  },
)
await appendFile(
  process.env.GITHUB_OUTPUT,
  `deployment-id=${result.deploymentId}\n`,
)
await appendFile(
  process.env.GITHUB_STEP_SUMMARY,
  `### Published ${result.publication.version}\nBuild: ${result.publication.buildId}\nSource: ${result.publication.sourceSha}\nArtifact: ${result.publication.artifactId}\nSHA-256: ${result.publication.artifactDigest}\nPublication intent: ${result.publication.intent}\n\nPublication succeeded; the following deployment step determines whether these files reach production.\n`,
)
