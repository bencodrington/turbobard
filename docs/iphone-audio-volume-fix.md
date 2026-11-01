# iPhone volume and fade fix

## Cause and decision

The adapter used an immediate `HTMLMediaElement.volume` readback to decide
whether element volume could control amplitude. On the physical iPhone, a write
to zero briefly read back as zero, then returned to one on a later task. Two
earlier device comparisons measured ineffective half-volume and abrupt
Stop/Environment transitions through this path. Forcing the existing GainNode
path restored the expected amplitude ramps.

The fix removes that property test. Browsers with Web Audio use the existing
media-element-to-GainNode path for Loops, automatic One-shots and manual
One-shots. One AudioContext is created lazily per adapter and resumed from
playback actions. Browsers without Web Audio retain element volume control.
This also changes desktop playback to the gain path. It avoids an asynchronous
probe that would still equate property persistence with effective amplitude
control and require coordinating the decision with loading and gestures.

Media remains streamed through HTMLAudioElement. `crossOrigin` is assigned
before `src`. A real catalog asset (`rainy-day-in-the-forest.mp3`) returned
HTTP 200 and `Access-Control-Allow-Origin: *` in the loading check.

## Verification on 2026-11-01

The new regression test failed before the fix for transient and writable probe
properties: gain stayed at 1 instead of reaching approximately 0.4 halfway
through a fade. It passes after removing the probe. Unit coverage also checks
context reuse across all three playback entry points, source reuse, CORS
assignment order and the no-Web-Audio fallback.

`npm run verify:static` passed, including 118 unit tests, formatting, lint,
typechecking and the production build.

The full routine browser matrix passed 153 tests with two existing skips.

Native Chromium, Firefox and Chromium mobile-profile signal checks passed
without modifying the volume property or forcing the adapter's path. Native
WebKit checks are skipped on this Windows build because it has no AudioContext;
physical iPhone Safari supplies separate native coverage. Simulated app tests
cover Stop, Environment switches and restart timing in all five browser
projects.

The physical-iPhone runner used native Safari WebDriver with the unmodified
production adapter and coordinator. It verified the selected physical device
and rejected simulator sessions. No autoplay override or volume-property mock
was used. Every measurement assertion passed:

| Measurement                                   |                Result |
| --------------------------------------------- | --------------------: |
| Half-volume / full-volume amplitude           |                 0.500 |
| Stop amplitude near 0.5 / 1.0 / 1.75 seconds  | 0.783 / 0.527 / 0.144 |
| Outgoing Environment, same windows            | 0.780 / 0.529 / 0.141 |
| Incoming Environment, same windows            | 0.104 / 0.470 / 0.854 |
| Playback errors                               |                  None |
| Pause timing and active playback during fades |                  Pass |

Raw results and source hashes are ignored under
`docs/evidence/device-audio/20261101-131042/results/`. Device identifiers remain
in that local evidence. The manifest records the base commit and the actual
adapter/coordinator/harness hashes, including uncommitted edits.

The graph measurement redirects output to an unplayed MediaStream and forbids
speaker connections. Its `outputAudioVerified` remains false: it measures
decoded signal rather than speaker output. Separately, the user opened the
production app preview in a normal iPhone tab, played the seeded Rain and Thunder
Environments using real catalog sources, switched between them, and stopped
playback. The user confirmed: **“Yes, the fades sound smooth.”** This supplies
listening acceptance for that route, not a calibrated acoustic recording.

Bluetooth, installed-PWA playback, background/lock-screen behavior and
interruption recovery were not verified by this change.

## Explicit native browser check

Select the Node version in `.nvmrc`, install dependencies, then run:

```powershell
npm run build
npm run test:audio:native
```

Native rendering is opt-in and excluded from routine E2E discovery and CI. The
fixture injects a stream destination and refuses playback without that route;
nothing consumes the stream. A silent graph fails calibration. Results are
saved under ignored `docs/evidence/native-audio/`.

## Explicit physical iPhone check

Keep the selected phone connected by USB and unlocked, the Mac awake, SSH key
login working, and Safari Remote Automation enabled. With the correct Node
selected, run:

```powershell
./scripts/run-device-audio.ps1 `
  -SshTarget '<mac-user>@<mac-address>' `
  -IdentityFile '<absolute-path-to-SSH-private-key>' `
  -DeviceId '<physical-device-UDID>' `
  -MacAddress '<Mac-LAN-IP-reachable-by-iPhone>'
```

This builds and transfers the fixture, runs the production path, retrieves the
manifest and measurements, and closes its Safari session, driver and temporary
HTTP server. Each playback/restart/switch uses a fresh trusted touch. The runner
sends touch-down and touch-up in separate WebDriver requests because a combined
request selected text without activating the button on the tested setup.
Missing devices, failed gestures, playback errors and failed amplitude checks
produce a nonzero exit; there is no emulation fallback. Remote diagnostic files
are retained for inspection. Speaker listening is a separate manual check.
