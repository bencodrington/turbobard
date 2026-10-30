// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('deployment scripts under native Node TypeScript execution', () => {
  it.each(['publish', 'record-staging', 'record-production'])(
    '%s loads its real module graph and reaches the credential guard',
    (script) => {
      const result = spawnSync(process.execPath, [`scripts/${script}.ts`], {
        cwd: new URL('..', import.meta.url),
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          GH_TOKEN: '',
          GITHUB_REPOSITORY: 'owner/repo',
          GITHUB_REF: 'refs/heads/main',
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          RUNNER_TEMP: '.',
          GITHUB_OUTPUT: 'unused-output',
          GITHUB_STEP_SUMMARY: 'unused-summary',
          DEPLOYMENT_ID: '1',
        },
      })

      expect(result.error).toBeUndefined()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Error: Missing GitHub configuration')
      expect(result.stderr).not.toContain('ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX')
    },
  )
})
