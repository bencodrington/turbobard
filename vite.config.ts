import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { createBuildInfo } from './build/metadata'

const info = createBuildInfo(
  process.env,
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'build-identity',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build-info.json',
          source: JSON.stringify(info, null, 2) + '\n',
        })
      },
    },
  ],
  define: {
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(info.commit),
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(info.buildId),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(info.builtAt),
  },
})
