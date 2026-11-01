import { build } from 'vite'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'

const outDir = path.resolve('docs/evidence/device-audio/build')
const adapter = await readFile('src/audio/browser.ts', 'utf8')
await build({
  configFile: false,
  build: {
    outDir,
    emptyOutDir: true,
    lib: {
      entry: path.resolve('tests/device/audio-comparison.ts'),
      formats: ['iife'],
      name: 'DeviceAudioComparison',
      fileName: () => 'comparison.js',
    },
  },
})
await mkdir(outDir, { recursive: true })
await writeFile(
  path.join(outDir, 'index.html'),
  '<!doctype html><html><meta name="viewport" content="width=device-width"><title>TurboBard silent device diagnostic</title><style>body{padding:80px 20px}button{padding:24px;font-size:20px;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}</style><button id="run">Run silent comparison</button><p id="status">Ready</p><script src="comparison.js"></script></html>',
)
await writeFile(
  path.join(outDir, 'build.json'),
  JSON.stringify(
    {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      adapterSha256: createHash('sha256').update(adapter).digest('hex'),
      coordinatorSha256: createHash('sha256')
        .update(await readFile('src/domain/coordinator.ts'))
        .digest('hex'),
      harnessSha256: createHash('sha256')
        .update(await readFile('tests/device/audio-comparison.ts'))
        .digest('hex'),
      builtAt: new Date().toISOString(),
      adapterOverride: false,
      output: 'unplayed MediaStream; no speaker connection',
    },
    null,
    2,
  ),
)
console.log(`Device diagnostic built in ${outDir}`)
