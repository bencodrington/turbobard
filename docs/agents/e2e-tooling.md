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

`browser-audio.spec.ts` bundles the production browser adapter and plays a
generated WAV through real media decoding and Web Audio. It forces only the
capability decision to exercise the gain fallback. A cross-origin fixture with
CORS headers is measured after the gain node using an analyser; assertions check
non-silent output, fade-in, half-volume calibration, and fade-out before pause.
It keeps normal autoplay policy and starts playback through a browser click.
JSON measurements are attached to Playwright results, including on failures.

The generated tone must remain inaudible. The injected context exposes a real
`MediaStreamAudioDestinationNode` as its output, and the stream is never played
or connected to speakers. The test rejects speaker connections and refuses
media playback until the stream graph is connected, including when adapter
setup fails and would otherwise fall back to direct playback. Do not restore a
speaker output or make audible tests part of routine verification.

The Windows WebKit build on the development host has no `AudioContext`. Only
that combination, when the API is absent, explicitly skips the native signal
test; run it on Linux/macOS WebKit for signal coverage. Simulated tests still
run on all five configured projects. Report skips separately from passes.

Neither test is a physical-device or speaker-output check. See
[the mobile audio investigation](../mobile-audio-device-research.md) for the
device acceptance plan and user-triggered CLI/API connection options.

### Headless Linux audio output

Native Firefox Web Audio needs a usable audio output. Installing browser system
libraries alone does not start an audio server. The verification workflow starts
PulseAudio, creates a named null sink, selects it as the default output, and
prints the server/sink information before launching browser tests. The null
sink supplies a clocked output without requiring physical speakers; decoding,
gain processing, analyser samples and autoplay policy remain real.

If the context stays `suspended` despite a trusted Play click, inspect the
attached `audioTime` and RMS samples and verify `pactl info` and
`pactl list short sinks` in the runner environment. Do not skip Firefox, force
the context state, or disable autoplay policy to make the test pass.

PulseAudio's [null-sink documentation](https://wiki.freedesktop.org/www/Software/PulseAudio/Documentation/User/Modules/#module-null-sink)
describes the system-clocked sink, and its [default-device documentation](https://wiki.freedesktop.org/www/Software/PulseAudio/Documentation/User/DefaultDevice/)
describes selecting the fallback output with `pactl`.
