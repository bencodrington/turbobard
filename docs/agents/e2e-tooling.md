# Browser verification

Use the repository scripts so browser verification has a known browser, visible progress, and bounded failure modes.

## First run

After reading `docs/agents/node-tooling.md` and selecting the `.nvmrc` runtime:

```powershell
npm ci
npm run test:e2e:install
npm run test:e2e:chromium
```

`test:e2e:install` installs Chromium for the fast local path. CI installs all three supported browsers and their operating-system dependencies before running `npm run verify`.

## Diagnostics

Use the following sequence when Chromium verification fails or appears stuck:

```powershell
npm run build
npm run test:e2e:chromium:debug
```

The Playwright configuration provides a line reporter, a 30-second test and preview-server timeout, and a two-minute global timeout. The debug command keeps full traces on failure. Inspect `playwright-report/` for the HTML report and `test-results/` for traces, screenshots, and videos.

On Windows sandboxed environments, the Playwright config points `PLAYWRIGHT_BROWSERS_PATH` at the standard per-user cache under `%USERPROFILE%\AppData\Local\ms-playwright`. This avoids resolving the browser from an isolated `LOCALAPPDATA` cache that may not contain the installed executable.

Browser launch is also bounded at 30 seconds. To verify test discovery without launching a browser, use `npm run test:e2e:chromium:list`.

If the run fails before a test begins, run `npm run test:e2e:install` and retry. The preview server uses strict port `4173` and never silently reuses an existing server. Check that the port is free and that `npm run build` succeeds:

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
```

Stop only a preview process you started, then retry so Playwright owns the server lifecycle. A port conflict now fails immediately with the server output instead of connecting to stale application code.

If `4173` is reserved by another local service, choose a free port for one run:

```powershell
$env:E2E_PORT = '4175'
npm run test:e2e:chromium
Remove-Item Env:E2E_PORT
```

## Focused runs

```powershell
npm run test:e2e:chromium -- tests/e2e/smoke.spec.ts
npm run test:e2e:chromium:debug -- tests/e2e/smoke.spec.ts
```

Use `npm run test:e2e` only when cross-browser verification is required; it runs Chromium, Firefox, and WebKit.

## Audio regression checks

After selecting the `.nvmrc` runtime and building the app:

```powershell
npm run build
npm run test:e2e:audio
```

`audio-fades.spec.ts` tests the real app workflow with simulated ignored-volume
audio APIs and controlled time. It verifies fade-in, Stop, distinct Environment
crossfades, and rapid restart, including ramp duration and pause/unload order.
Each action clears prior events so fade-in cannot satisfy fade-out assertions.

These tests use simulated audio APIs and produce no audio. They run on all five
configured projects. They establish command timing and lifecycle behavior, not
real decoding, gain processing, or audibility on a physical device.

Routine test runs must not play generated tones or other audible audio. The
experimental native graph test was removed after audible playback and failures
in the Linux CI environment. Do not restore audible tests to routine verification.
Keep real-device and output-recording tests explicitly user-triggered.

See [the mobile audio investigation](../mobile-audio-device-research.md) for the
remaining evidence gaps, device acceptance plan, and Mac/Safari WebDriver setup.
