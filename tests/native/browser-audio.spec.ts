import { expect, test } from '@playwright/test'
import { build } from 'vite'
import path from 'node:path'
import type { AudioPort } from '../../src/domain/ports'
import type { createBrowserAudioPort } from '../../src/audio/browser'

type Sample = { ms: number; rms: number; paused: boolean }

declare global {
  interface Window {
    TurbobardAudio: { createBrowserAudioPort: typeof createBrowserAudioPort }
    __nativeAudio: {
      port: AudioPort
      element: HTMLAudioElement
      context?: AudioContext
      samples: Sample[]
      errors: string[]
      phaseStarted: number
      output: 'unconnected' | 'stream'
    }
  }
}

// Known constant-amplitude input: 8 seconds of mono 440 Hz PCM, peak 0.5.
// Generated in memory so no binary evidence or external audio is needed.
function toneWav() {
  const rate = 44100
  const count = rate * 8
  const wav = Buffer.alloc(44 + count * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(count * 2, 40)
  for (let i = 0; i < count; i++) {
    wav.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 16383),
      44 + i * 2,
    )
  }
  return wav
}

let adapterScript: string
test.beforeAll(async () => {
  // Bundle the production adapter, not a reimplementation of its fade logic.
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: path.resolve('src/audio/browser.ts'),
        name: 'TurbobardAudio',
        formats: ['iife'],
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  adapterScript = outputs
    .flatMap((output) => ('output' in output ? output.output : []))
    .filter((output) => output.type === 'chunk')
    .map((output) => output.code)
    .join('\n')
  expect(adapterScript).toContain('createBrowserAudioPort')
})

for (const suffix of ['', ' @mobile']) {
  test(`real media and Web Audio: decoded signal fades through the adapter gain path${suffix}`, async ({
    page,
    browserName,
  }, testInfo) => {
    const wav = toneWav()
    await page.route('**/__audio-test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<button id="play">Play tone</button><button id="stop">Stop tone</button>',
      }),
    )
    await page.route('**/__tone.wav', (route) =>
      route.fulfill({
        contentType: 'audio/wav',
        headers: { 'access-control-allow-origin': '*' },
        body: wav,
      }),
    )
    await page.goto('/__audio-test')
    const hasWebAudio = await page.evaluate(
      () => typeof AudioContext !== 'undefined',
    )
    test.skip(
      process.platform === 'win32' && browserName === 'webkit' && !hasWebAudio,
      'This Windows WebKit build has no AudioContext. Run real signal coverage on Linux/macOS; simulated app tests still run.',
    )
    expect(hasWebAudio, 'Real Web Audio must be available').toBe(true)
    await page.addScriptTag({ content: adapterScript })
    await page.evaluate(() => {
      const element = new Audio()
      const state = (window.__nativeAudio = {
        element,
        samples: [] as Sample[],
        errors: [] as string[],
        phaseStarted: 0,
        output: 'unconnected',
      } as Window['__nativeAudio'])
      // Fail closed: if graph setup fails, the adapter can fall back to direct
      // media playback. Never let that fallback play a tone on the speakers.
      const play = element.play.bind(element)
      element.play = () => {
        if (state.output !== 'stream')
          return Promise.reject(
            new Error('Refusing tone playback without a stream-only output'),
          )
        return play()
      }
      const port = window.TurbobardAudio.createBrowserAudioPort(
        () => element,
        () => {
          const context = (state.context = new AudioContext())
          const speakers = context.destination
          const streamOutput = context.createMediaStreamDestination()
          // The injected context exposes a real MediaStream destination instead
          // of the system output. Nothing consumes this stream or plays it.
          Object.defineProperty(context, 'destination', { value: streamOutput })
          const createGain = context.createGain.bind(context)
          context.createGain = () => {
            const gain = createGain()
            const connect = gain.connect.bind(gain)
            gain.connect = ((destination: AudioNode) => {
              if (destination === speakers)
                throw new Error('Speaker output is forbidden in audio tests')
              const result = connect(destination)
              if (destination === streamOutput) state.output = 'stream'
              return result
            }) as typeof gain.connect
            const analyser = context.createAnalyser()
            analyser.fftSize = 2048
            gain.connect(analyser)
            // Measure before the stream destination, without an output path
            // to speakers. The adapter owns the gain -> stream connection.
            const data = new Float32Array(analyser.fftSize)
            setInterval(() => {
              analyser.getFloatTimeDomainData(data)
              const rms = Math.sqrt(
                data.reduce((sum, value) => sum + value * value, 0) /
                  data.length,
              )
              state.samples.push({
                ms: performance.now() - state.phaseStarted,
                rms,
                paused: element.paused,
              })
            }, 40)
            return gain
          }
          return context
        },
      )
      state.port = port
      port.onError?.((_id, error) => state.errors.push(String(error)))
      const sound = {
        id: 'tone',
        kind: 'loop' as const,
        placement: 'ambiance' as const,
        volume: 1,
        source: { urls: ['https://audio-fixture.test/__tone.wav'] },
      }
      port.load(sound)
      document.getElementById('play')!.onclick = () => {
        state.samples.length = 0
        state.phaseStarted = performance.now()
        port.playLoop(sound, 1, 2000)
      }
      document.getElementById('stop')!.onclick = () => {
        state.samples.length = 0
        state.phaseStarted = performance.now()
        port.stop(sound.id, 2000)
      }
    })
    await expect
      .poll(() => page.evaluate(() => window.__nativeAudio.element.readyState))
      .toBeGreaterThanOrEqual(3)
    await page.getByRole('button', { name: 'Play tone' }).click()
    try {
      await expect
        .poll(() =>
          page.evaluate(() => window.__nativeAudio.samples.at(-1)?.ms ?? 0),
        )
        .toBeGreaterThan(2200)
      const started = await page.evaluate(() => ({
        samples: window.__nativeAudio.samples,
        errors: window.__nativeAudio.errors,
        state: window.__nativeAudio.context?.state,
        audioTime: window.__nativeAudio.context?.currentTime,
        output: window.__nativeAudio.output,
        crossOrigin: window.__nativeAudio.element.crossOrigin,
      }))
      expect(started.errors).toEqual([])
      expect(started.output).toBe('stream')
      expect(
        started.state,
        'AudioContext must render; headless Linux needs a running audio server/output (see e2e-tooling.md)',
      ).toBe('running')
      expect(started.crossOrigin).toBe('anonymous')
      const baseline = started.samples
        .filter((s) => s.ms >= 2050)
        .map((s) => s.rms)
      expect(baseline.length).toBeGreaterThan(0)
      const fullLevel =
        baseline.reduce((sum, value) => sum + value, 0) / baseline.length
      expect(fullLevel).toBeGreaterThan(0.25) // a silent graph must fail
      expect(fullLevel).toBeLessThan(0.45)
      const fadeIn = started.samples.filter((s) => s.ms >= 600 && s.ms <= 1400)
      expect(fadeIn.length).toBeGreaterThan(5)
      expect(
        fadeIn.every(
          (s) => s.rms > fullLevel * 0.15 && s.rms < fullLevel * 0.85,
        ),
      ).toBe(true)
      expect(fadeIn.at(-1)!.rms).toBeGreaterThan(fadeIn[0].rms * 1.3)

      await page.evaluate(() =>
        window.__nativeAudio.port.setVolume('tone', 0.5),
      )
      await expect
        .poll(() =>
          page.evaluate(() => window.__nativeAudio.samples.at(-1)?.rms ?? 0),
        )
        .toBeCloseTo(fullLevel * 0.5, 2)
      await page.evaluate(() => window.__nativeAudio.port.setVolume('tone', 1))
      await expect
        .poll(() =>
          page.evaluate(() => window.__nativeAudio.samples.at(-1)?.rms ?? 0),
        )
        .toBeCloseTo(fullLevel, 2)

      await page.getByRole('button', { name: 'Stop tone' }).click()
      await expect
        .poll(() =>
          page.evaluate(
            () => window.__nativeAudio.samples.at(-1)?.paused ?? false,
          ),
        )
        .toBe(true)
      const stopped = await page.evaluate(() => ({
        samples: window.__nativeAudio.samples,
        errors: window.__nativeAudio.errors,
      }))
      const middle = stopped.samples.filter((s) => s.ms >= 600 && s.ms <= 1400)
      expect(middle.length).toBeGreaterThan(5)
      expect(
        middle.every(
          (s) =>
            !s.paused && s.rms > fullLevel * 0.15 && s.rms < fullLevel * 0.85,
        ),
      ).toBe(true)
      expect(middle.at(-1)!.rms).toBeLessThan(middle[0].rms * 0.8)
      // Native media state and sample delivery cross threads. Use a 250 ms
      // observation tolerance; the controlled-clock app tests enforce the
      // exact two-second command timing independently.
      const tail = stopped.samples.filter(
        (s) => s.ms >= 1750 && s.ms < 2000 && !s.paused,
      )
      expect(tail.length).toBeGreaterThan(0)
      expect(tail.at(-1)!.rms).toBeLessThan(fullLevel * 0.15)
      const paused = stopped.samples.find((s) => s.paused)
      expect(paused).toBeDefined()
      expect(paused!.ms).toBeGreaterThanOrEqual(1750)
      expect(paused!.ms).toBeLessThanOrEqual(2250)
      expect(stopped.errors).toEqual([])
      await testInfo.attach('native-audio-signal.json', {
        body: JSON.stringify({ started, stopped, fullLevel }, null, 2),
        contentType: 'application/json',
      })
    } finally {
      await testInfo.attach('native-audio-last-phase.json', {
        body: JSON.stringify(
          await page.evaluate(() => ({
            samples: window.__nativeAudio.samples,
            errors: window.__nativeAudio.errors,
            contextState: window.__nativeAudio.context?.state,
            audioTime: window.__nativeAudio.context?.currentTime,
            output: window.__nativeAudio.output,
            mediaError: window.__nativeAudio.element.error?.message,
          })),
          null,
          2,
        ),
        contentType: 'application/json',
      })
      await page.evaluate(async () => {
        window.__nativeAudio.port.unload('tone')
        await window.__nativeAudio.context?.close()
      })
    }
  })
}
