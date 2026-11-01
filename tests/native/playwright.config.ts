import { defineConfig } from '@playwright/test'
import config from '../../playwright.config'

// Explicit opt-in: native audio rendering is not part of routine CI.
export default defineConfig({
  ...config,
  testDir: '.',
  outputDir: '../../docs/evidence/native-audio',
})
