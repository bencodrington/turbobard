import { chromium, defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Codex's Windows sandbox gives child processes an isolated LOCALAPPDATA,
// while Playwright's browsers are installed in the user's normal cache.
// Prefer the explicit user cache when it exists so browser launch does not
// wait indefinitely for an executable that is outside the sandbox cache.
let chromiumExecutablePath: string | undefined
if (
  process.platform === 'win32' &&
  !process.env.PLAYWRIGHT_BROWSERS_PATH &&
  process.env.USERPROFILE
) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
    process.env.USERPROFILE,
    'AppData',
    'Local',
    'ms-playwright',
  )
  const candidate = chromium.executablePath()
  if (existsSync(candidate)) chromiumExecutablePath = candidate
}

const e2ePort = Number(process.env.E2E_PORT ?? 4173)
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  // The full five-project matrix needs more time on shared CI runners.
  globalTimeout: process.env.CI ? 300_000 : 120_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['line']]
    : [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eBaseUrl,
    launchOptions: { timeout: 30_000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@mobile/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumExecutablePath
          ? { executablePath: chromiumExecutablePath }
          : undefined,
      },
    },
    {
      name: 'firefox',
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chromium-mobile',
      grep: /@mobile/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'webkit-mobile',
      grep: /@mobile/,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  outputDir: './test-results',
})
