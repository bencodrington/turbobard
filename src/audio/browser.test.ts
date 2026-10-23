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
