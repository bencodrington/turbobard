import { githubFromEnvironment } from '../build/github.ts'
import { appendFile } from 'node:fs/promises'

const { DEPLOYMENT_ID, DEPLOY_OUTCOME, GITHUB_STEP_SUMMARY } = process.env
if (!DEPLOYMENT_ID || !/^[1-9]\d*$/.test(DEPLOYMENT_ID))
  throw new Error('Missing deployment ID')
const state = DEPLOY_OUTCOME === 'success' ? 'success' : 'failure'
await githubFromEnvironment().request(
  `deployments/${DEPLOYMENT_ID}/statuses`,
  'POST',
  {
    state,
    auto_inactive: false,
    description:
      state === 'success'
        ? 'Retained files deployed to production'
        : 'Inspect Cloudflare before retrying this publication',
  },
)
if (GITHUB_STEP_SUMMARY)
  await appendFile(
    GITHUB_STEP_SUMMARY,
    `\nProduction deployment: **${state}**. Manually check the private provider URL and About build identity.\n`,
  )
