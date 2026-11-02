# iPhone audio fades: overview and device testing

## High-level summary

TurboBard plays Sounds inside **Environments** (collections of audio for a scene). When a Loop starts, stops, or an Environment changes, its volume should change gradually over two seconds. On the reported iPhone, Sounds instead stayed loud and then stopped abruptly. Desktop playback appeared to fade correctly.

The cause was a misleading browser check in TurboBard. The app set an audio element's volume and immediately read it back to decide whether that control worked. On the physical iPhone, the readback briefly appeared correct, then reverted to full volume. TurboBard therefore chose a control that did not change the sound's amplitude. The app now uses its existing **Web Audio gain control** whenever Web Audio is available. This applies to Loops and both scheduled and manually played One-shots; browsers without Web Audio still use the audio element's volume control. Audio files remain streamed through media elements.

The fix was verified on a physical iPhone with silent measurements of the production audio code, then by a person listening to real catalog Sounds in a normal Safari tab. The user confirmed that switching from Rain to Thunder and stopping sounded smooth. That listening check covers the tested phone and output route; Bluetooth, installed-app playback, background or lock-screen playback, and interruption recovery still need separate checks.

## How the work developed

1. [Issue #51](https://github.com/bencodrington/turbobard/issues/51) reported abrupt mobile Environment transitions and asked for two-second start, stop, and switch fades while preserving volume changes, shared Sounds, rapid switches, and normal playback gestures.
2. [PR #52](https://github.com/bencodrington/turbobard/pull/52) added a Web Audio `GainNode` fallback when an immediate volume-property check appeared to fail. Its red-green tests used simulated audio APIs. They demonstrated the suspected behavior in a fake browser but did not reproduce the failing iPhone. A later review found that the browser fade-out test could pass using earlier fade-in events even if fade-out was removed; it also lacked a real Environment switch. The PR disclosed that physical-iPhone output was unverified.
3. [PR #69](https://github.com/bencodrington/turbobard/pull/69) replaced that browser test with silent, action-specific regressions for Stop, both sides of an Environment switch, two-second timing, and rapid restart. Deliberately removing fade-out or replacing it with instant mute made the new test fail. This strengthened coverage without changing production audio. The attempted routine real-tone test was removed because it made audible beeps and was unreliable in CI.
4. A physical-iPhone pilot showed the volume property read `0` immediately after a write, then returned to `1` on the next JavaScript task. Two silent device comparisons then measured the old production path at roughly **100% amplitude when set to 50%**, with outgoing Sounds staying loud until pause. Forcing the existing gain path measured about **50% amplitude** and gradual outgoing and incoming ramps. These results identified the routing decision as the defect on that device; the measurements did not establish speaker output.
5. [PR #70](https://github.com/bencodrington/turbobard/pull/70), merged as `1d7aba6` on 2026-11-01, removed the unreliable property check. One Web Audio context is created lazily per adapter and resumed during playback actions. The updated, unmodified production path passed the physical-iPhone amplitude and fade checks. A separate normal-tab listening check with real catalog Sounds confirmed smooth fades. Desktop browsers with Web Audio now use the gain path too; the fallback remains for browsers without it.

The detailed diagnosis, raw measurement boundaries, and alternative approaches are in [the investigation](mobile-audio-device-research.md) and [the implemented fix report](iphone-audio-volume-fix.md).

PR #70 is merged into `main`; deployment to staging or production is a separate step described in [deployment operations](deployment-operations.md). Confirm the deployed build identity before treating a live site as the tested version.

## Run the tests

The phone checks are run on demand. Routine unit and browser tests use silent simulations; they cannot establish what a physical iPhone speaker produces. Select Node from [`.nvmrc`](../.nvmrc) first (currently Node 26), following [Node tooling](agents/node-tooling.md), then run `npm ci` if dependencies are not installed.

### Local checks, without a phone

```powershell
npm run verify:static
npm run build
npm run test:e2e:audio
```

Install the configured Playwright browsers once with `npx playwright install` if they are not already present. `verify:static` checks formatting, lint, types, unit tests, and the build. `test:e2e:audio` checks the app's fade commands and timing across configured browser projects with simulated audio. To check real browser decoding and gain processing through an **unplayed, silent** stream, run `npm run test:audio:native` separately. It is excluded from routine CI; Windows WebKit cases skip when that build lacks `AudioContext`. Native results go under ignored `docs/evidence/native-audio/`.

### Physical iPhone through a Mac

One-time preparation:

1. On the Mac, run `/usr/bin/safaridriver --enable` and enable **Remote Login** for SSH access from the Windows machine. Establish key-based SSH login and trust the Mac's host key.
2. On the iPhone, enable Safari **Web Inspector** and **Remote Automation** under Safari's Advanced settings, connect it to the Mac with a data-capable USB cable, accept the trust prompt, and keep it unlocked. Keep the Mac awake. Use the device's physical UDID, not a simulator identifier.
3. Keep the iPhone and Mac on a network where the iPhone can reach the Mac's LAN IP. The Mac needs its installed Python 3 and Safari driver; this runner does not require Appium, Selenium, Xcode, or WebDriverAgent.

From Windows PowerShell, with Node 26 and dependencies ready, run:

```powershell
./scripts/run-device-audio.ps1 `
  -SshTarget '<mac-user>@<Mac-hostname-or-IP>' `
  -IdentityFile '<absolute-path-to-SSH-private-key>' `
  -DeviceId '<physical-device-UDID>' `
  -MacAddress '<Mac-LAN-IP-reachable-by-iPhone>'
```

Despite its parameter name, `-MacAddress` takes the Mac's **LAN IP address or hostname**, not a hardware MAC address. The wrapper builds the diagnostic, copies it to the Mac over SSH, starts a temporary HTTP server and Safari WebDriver session for the selected physical phone, performs trusted touch actions, and retrieves the results to ignored `docs/evidence/device-audio/<timestamp>/results/`. It closes the session, driver, and server afterward. A missing or wrong device, failed touch, playback error, or failed amplitude check makes the command fail; it does not substitute emulation. Keep result files out of commits because they can contain device identifiers.

The device runner measures the decoded signal through an unplayed stream, with no speaker connection. It exercises the production audio adapter and playback coordinator, rather than the full React interface. For listening acceptance, also open the actual app in a normal Safari tab on the phone, play one Environment, switch to another, and Stop at a comfortable volume. Record the app build, iPhone/iOS/Safari versions, output route, and what you heard. A passing silent run alone does not verify sound from the speaker.

## File guide

| File                                                                                                                                                                                                                 | Why it matters                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Implemented fix and results](iphone-audio-volume-fix.md)                                                                                                                                                            | Root cause, before/after verification, physical-iPhone measurements, listening acceptance, and remaining coverage gaps.                                                                                             |
| [Investigation and device research](mobile-audio-device-research.md)                                                                                                                                                 | History of the original test gap, competing hypotheses, evidence limits, and broader device setup options. Its pre-fix proposal is historical; use this overview and the fix report for the current implementation. |
| [Browser audio adapter](../src/audio/browser.ts)                                                                                                                                                                     | Streams Sounds, creates the Web Audio gain path, changes volume, fades, pauses, and unloads audio.                                                                                                                  |
| [Playback coordinator](../src/domain/coordinator.ts) and [playback rules](../src/domain/playback.ts)                                                                                                                 | Decide which Sounds play and define the shared two-second fade duration.                                                                                                                                            |
| [Adapter unit tests](../src/audio/browser.test.ts)                                                                                                                                                                   | Regression for transient volume readback, gain-path selection, context reuse, CORS assignment order, and fallback behavior.                                                                                         |
| [Silent app fade tests](../tests/e2e/audio-fades.spec.ts)                                                                                                                                                            | Stop, Environment crossfade, and rapid-restart command and timing checks using simulated audio.                                                                                                                     |
| [Native browser tests](../tests/native/browser-audio.spec.ts)                                                                                                                                                        | Opt-in, silent real-browser decoding and signal checks.                                                                                                                                                             |
| [Device diagnostic](../tests/device/audio-comparison.ts), [build script](../scripts/build-device-audio.mts), [PowerShell wrapper](../scripts/run-device-audio.ps1), and [Mac runner](../scripts/run-device-audio.py) | Build, transfer, run, and measure the selected physical-iPhone test.                                                                                                                                                |
| [Browser verification guide](agents/e2e-tooling.md) and [Node tooling](agents/node-tooling.md)                                                                                                                       | Test commands, first-run setup, and the required runtime.                                                                                                                                                           |
| [Deployment operations](deployment-operations.md)                                                                                                                                                                    | How to check build identity and move a merged build through staging and production.                                                                                                                                 |
