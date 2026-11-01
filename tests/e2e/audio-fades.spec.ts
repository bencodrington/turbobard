import { expect, test, type Page } from '@playwright/test'

type AudioEvent = {
  type: 'gain' | 'play' | 'pause' | 'resume'
  source: string
  time: number
  value?: number
}

declare global {
  interface Window {
    __fadeEvents: AudioEvent[]
  }
}

// This deliberately models ignored volume writes. It verifies app commands,
// not native Web Audio processing or the behavior of a physical iPhone.
async function simulatedIgnoredVolume(page: Page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'))
  await page.addInitScript(() => {
    const events: AudioEvent[] = (window.__fadeEvents = [])
    const record = (type: AudioEvent['type'], source = '', value?: number) =>
      events.push({ type, source, value, time: performance.now() })
    const createElement = document.createElement.bind(document)
    document.createElement = ((tag: string) => {
      const element = createElement(tag)
      if (tag === 'audio') {
        Object.defineProperty(element, 'volume', {
          get: () => 1,
          set: () => undefined,
        })
      }
      return element
    }) as typeof document.createElement

    class SimulatedAudio {
      src = ''
      currentTime = 0
      loop = false
      preload = ''
      crossOrigin = null
      get volume() {
        return 1
      }
      set volume(_value: number) {}
      addEventListener() {}
      load() {}
      play() {
        record('play', this.src)
        return Promise.resolve()
      }
      pause() {
        record('pause', this.src)
      }
      removeAttribute() {
        this.src = ''
      }
    }
    class SimulatedContext {
      state = 'suspended'
      destination = {}
      createMediaElementSource(element: SimulatedAudio) {
        return {
          connect(node: { source: string }) {
            node.source = element.src
          },
        }
      }
      createGain() {
        let level = 1
        const node = {
          source: '',
          connect() {},
          gain: {
            get value() {
              return level
            },
            set value(value: number) {
              level = value
              record('gain', node.source, value)
            },
          },
        }
        return node
      }
      resume() {
        this.state = 'running'
        record('resume')
        return Promise.resolve()
      }
    }
    Object.defineProperty(window, 'Audio', { value: SimulatedAudio })
    Object.defineProperty(window, 'AudioContext', { value: SimulatedContext })
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: ['Rain', 'Wind'].map((name) => ({
          id: name.toLowerCase(),
          name,
          volume: 1,
          sounds: [
            {
              id: name.toLowerCase(),
              name,
              kind: 'loop',
              placement: 'ambiance',
              volume: 1,
              source: { urls: [`/${name.toLowerCase()}.wav`] },
            },
          ],
        })),
      }),
    )
  })
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/')
}

async function events(page: Page, source: string) {
  return page.evaluate(
    (source) => window.__fadeEvents.filter((e) => e.source === source),
    source,
  )
}

async function clearEvents(page: Page) {
  await page.evaluate(() => {
    window.__fadeEvents.length = 0
  })
}

function expectRamp(recorded: AudioEvent[], from: number, to: number) {
  const gains = recorded.filter((e) => e.type === 'gain')
  expect(gains.length).toBeGreaterThan(20)
  expect(gains[0].value).toBeCloseTo(from, 1)
  expect(gains.at(-1)!.value).toBeCloseTo(to, 1)
  // Independent contract: a two-second fade traverses its middle half over
  // about one second. A step, instant mute, or substantially faster ramp fails.
  const middle = gains.filter((e) => e.value! > 0.25 && e.value! < 0.75)
  expect(middle.length).toBeGreaterThan(10)
  expect(middle.at(-1)!.time - middle[0].time).toBeGreaterThan(900)
  expect(middle.at(-1)!.time - middle[0].time).toBeLessThan(1100)
  for (let i = 1; i < gains.length; i++) {
    expect(
      (gains[i].value! - gains[i - 1].value!) * Math.sign(to - from),
    ).toBeGreaterThanOrEqual(-0.000001)
  }
}

// Run the same contract in desktop engines and in mobile device profiles.
for (const suffix of ['', ' @mobile']) {
  test(`simulated volume limitation: Stop ramps down before pausing${suffix}`, async ({
    page,
  }) => {
    await simulatedIgnoredVolume(page)
    await page.getByRole('button', { name: 'Play Rain', exact: true }).click()
    await page.clock.runFor(2100)
    expectRamp(await events(page, '/rain.wav'), 0, 1)
    await clearEvents(page)

    await page.getByRole('button', { name: 'Stop Rain', exact: true }).click()
    await page.clock.runFor(1000)
    const halfway = await events(page, '/rain.wav')
    expect(halfway.some((e) => e.type === 'pause')).toBe(false)
    expect(halfway.filter((e) => e.type === 'gain').length).toBeGreaterThan(0)
    expect(halfway.filter((e) => e.type === 'gain').at(-1)!.value).toBeCloseTo(
      0.5,
      1,
    )
    await page.clock.runFor(1100)
    const stopped = await events(page, '/rain.wav')
    expectRamp(stopped, 1, 0)
    const pause = stopped.find((e) => e.type === 'pause')!
    expect(pause).toBeDefined()
    const lastGain = stopped.filter((e) => e.type === 'gain').at(-1)!
    expect(pause.time - stopped[0].time).toBeGreaterThanOrEqual(1950)
    expect(pause.time - stopped[0].time).toBeLessThanOrEqual(2050)
    expect(lastGain.time).toBeLessThanOrEqual(pause.time)
    expect(lastGain.value).toBeLessThan(0.02)
  })

  test(`simulated volume limitation: switching Environments crossfades distinct Sounds${suffix}`, async ({
    page,
  }) => {
    await simulatedIgnoredVolume(page)
    await page.getByRole('button', { name: 'Play Rain', exact: true }).click()
    await page.clock.runFor(2100)
    await clearEvents(page)

    await page.getByRole('button', { name: 'Play Wind', exact: true }).click()
    await page.clock.runFor(1000)
    for (const source of ['/rain.wav', '/wind.wav']) {
      const midway = await events(page, source)
      expect(midway.some((e) => e.type === 'pause')).toBe(false)
      expect(midway.filter((e) => e.type === 'gain').length).toBeGreaterThan(0)
      expect(midway.filter((e) => e.type === 'gain').at(-1)!.value).toBeCloseTo(
        0.5,
        1,
      )
    }
    await page.clock.runFor(1100)
    const outgoing = await events(page, '/rain.wav')
    const incoming = await events(page, '/wind.wav')
    expectRamp(outgoing, 1, 0)
    expectRamp(incoming, 0, 1)
    expect(outgoing.some((e) => e.type === 'pause')).toBe(true)
    expect(incoming.some((e) => e.type === 'pause')).toBe(false)
  })

  test(`simulated volume limitation: restarting during fade cancels stale pause and unload${suffix}`, async ({
    page,
  }) => {
    await simulatedIgnoredVolume(page)
    await page.getByRole('button', { name: 'Play Rain', exact: true }).click()
    await page.clock.runFor(2100)
    await page.getByRole('button', { name: 'Play Wind', exact: true }).click()
    await page.clock.runFor(500)
    await clearEvents(page)
    await page.getByRole('button', { name: 'Play Rain', exact: true }).click()
    await page.clock.runFor(2500)
    const restarted = await events(page, '/rain.wav')
    expect(restarted.some((e) => e.type === 'play')).toBe(true)
    expect(restarted.some((e) => e.type === 'pause')).toBe(false)
    expectRamp(restarted, 0, 1)
  })
}
