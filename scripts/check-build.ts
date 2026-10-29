import { readFile } from 'node:fs/promises'
import { verifyBuildInfo } from '../build/artifact.ts'

verifyBuildInfo(JSON.parse(await readFile('dist/build-info.json', 'utf8')), {
  commit: process.env.SOURCE_SHA ?? '',
  buildId: process.env.BUILD_ID ?? '',
})
