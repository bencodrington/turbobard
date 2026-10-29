import { describe, expect, it, vi } from 'vitest'
import { createBrowserAudioPort } from './browser'
import type { Sound } from '../domain/playback'

function element(source = '') {
  return {
    preload: '',
    loop: false,
    volume: 1,
    currentTime: 0,
    src: source,
    error: null,
    addEventListener: vi.fn(),
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
  } as unknown as HTMLAudioElement
}

const sound: Sound = {
  id: 'thunder',
  kind: 'one-shot',
  placement: 'ambiance',
  volume: 1,
  source: { urls: ['thunder.mp3'] },
  variations: ['thunder-a.mp3'],
}

describe('browser audio port', () => {
  it('keeps media volume assignments inside the browser-supported range', () => {
    const createAudio = vi.fn(element)
    const port = createBrowserAudioPort(createAudio)

    port.playLoop(sound, -0.001318, 0)
    const created = createAudio.mock.results[0]?.value as HTMLAudioElement

    expect(created.volume).toBe(0)
  })

  it('does not construct an audio element until a sound is loaded', () => {
    const createAudio = vi.fn(element)
    const port = createBrowserAudioPort(createAudio)

    expect(createAudio).not.toHaveBeenCalled()
    port.load(sound)

    expect(createAudio).toHaveBeenCalledWith('thunder.mp3')
  })

  it('prefers a playable WebM source over MP3 when the browser supports it', () => {
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'audio') {
        return { canPlayType: () => 'probably' } as unknown as HTMLAudioElement
      }
      return originalCreateElement(tagName)
    })
    const webmSound: Sound = {
      ...sound,
      source: { urls: ['thunder.mp3', 'thunder.webm'] },
    }
    const createAudio = vi.fn(element)

    createBrowserAudioPort(createAudio).load(webmSound)

    expect(createAudio).toHaveBeenCalledWith('thunder.webm')
  })

  it('switches a one-shot element to the requested variation', () => {
    const createAudio = vi.fn(element)
    const port = createBrowserAudioPort(createAudio)

    port.playOneShot(sound, 'thunder-a.mp3', 0.7)

    const created = createAudio.mock.results[0]?.value as HTMLAudioElement
    expect(created.src).toContain('thunder-a.mp3')
    expect(created.volume).toBe(0.7)
    expect(created.play).toHaveBeenCalled()
  })

  it('keeps automatic one-shot variations in separate audio instances after loading', () => {
    const createAudio = vi.fn(element)
    const port = createBrowserAudioPort(createAudio)

    port.load(sound)
    port.playOneShot(sound, 'thunder-a.mp3', 0.7)

    expect(createAudio).toHaveBeenCalledTimes(2)
    expect(createAudio.mock.calls.map((call) => call[0] as string)).toEqual([
      'thunder.mp3',
      'thunder-a.mp3',
    ])
    expect(createAudio.mock.results[1]?.value.play).toHaveBeenCalled()
  })

  it('fades and unloads every automatic one-shot variation when stopped', () => {
    vi.useFakeTimers()
    try {
      const createAudio = vi.fn(element)
      const port = createBrowserAudioPort(createAudio)

      port.load(sound)
      port.playOneShot(sound, 'thunder-a.mp3', 0.7)
      const base = createAudio.mock.results[0]?.value as HTMLAudioElement
      const variation = createAudio.mock.results[1]?.value as HTMLAudioElement

      port.stop(sound.id, 2000)
      vi.advanceTimersByTime(2000)

      expect(base.pause).toHaveBeenCalled()
      expect(variation.pause).toHaveBeenCalled()
      port.unload(sound.id)
      expect(base.removeAttribute).toHaveBeenCalledWith('src')
      expect(variation.removeAttribute).toHaveBeenCalledWith('src')
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a pending stop when a sound starts again during its fade', () => {
    vi.useFakeTimers()
    try {
      const createAudio = vi.fn(element)
      const port = createBrowserAudioPort(createAudio)

      port.playLoop(sound, 0.7, 0)
      const created = createAudio.mock.results[0]?.value as HTMLAudioElement

      port.stop(sound.id, 2000)
      port.playLoop(sound, 0.7, 2000)
      vi.advanceTimersByTime(2000)

      expect(created.pause).not.toHaveBeenCalled()
      expect(created.play).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fades out when the browser ignores HTMLMediaElement volume writes', () => {
    const callbacks: FrameRequestCallback[] = []
    const originalCreateElement = document.createElement.bind(document)
    const createProbe = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName) => {
        if (tagName !== 'audio') return originalCreateElement(tagName)
        const probe = {
          canPlayType: () => '',
          volume: 1,
        } as unknown as HTMLAudioElement
        Object.defineProperty(probe, 'volume', {
          get: () => 1,
          set: () => undefined,
        })
        return probe
      })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    try {
      const mobileElement = element()
      const assignments: string[] = []
      Object.defineProperty(mobileElement, 'volume', {
        configurable: true,
        get: () => 1,
        set: () => undefined,
      })
      Object.defineProperty(mobileElement, 'crossOrigin', {
        configurable: true,
        get: () => undefined,
        set: () => assignments.push('crossOrigin'),
      })
      Object.defineProperty(mobileElement, 'src', {
        configurable: true,
        get: () => 'rain.mp3',
        set: () => assignments.push('src'),
      })
      const gain = { gain: { value: 1 }, connect: vi.fn() }
      const audioContext = {
        state: 'suspended',
        destination: {},
        createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
        createGain: vi.fn(() => gain),
        resume: vi.fn(() => Promise.resolve()),
      }
      const createAudio = vi.fn(() => mobileElement)
      const port = createBrowserAudioPort(
        createAudio,
        () => audioContext as unknown as AudioContext,
      )

      const loopSound = { ...sound, kind: 'loop' as const }
      port.playLoop(loopSound, 0.8, 2000)
      callbacks[0]?.(performance.now() + 1000)
      expect(gain.gain.value).toBeCloseTo(0.4)
      port.setVolume(sound.id, 0.6)
      expect(gain.gain.value).toBe(0.6)
      port.stop(sound.id, 2000)
      callbacks[2]?.(performance.now() + 2000)

      expect(gain.gain.value).toBe(0)
      expect(createAudio).toHaveBeenCalledWith()
      expect(assignments).toEqual(['crossOrigin', 'src'])
      expect(audioContext.resume).toHaveBeenCalledOnce()
      expect(mobileElement.volume).toBe(1)
    } finally {
      vi.unstubAllGlobals()
      createProbe.mockRestore()
    }
  })

  it('reports manual playback errors through the audio port listener', () => {
    const createAudio = vi.fn(element)
    const port = createBrowserAudioPort(createAudio)
    const onError = vi.fn()
    port.onError?.(onError)

    port.playManualOneShot(sound, 'thunder-a.mp3')
    const created = createAudio.mock.results[0]?.value as HTMLAudioElement
    const errorListener = vi.mocked(created.addEventListener).mock
      .calls[0]?.[1] as EventListener | undefined
    errorListener?.(new Event('error'))

    expect(onError).toHaveBeenCalledWith('thunder', null)
  })
})
