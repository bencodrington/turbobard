import type { AudioPort } from '../domain/ports'
import type { Sound } from '../domain/playback'

type AudioElement = HTMLAudioElement & { __fadeTimer?: number }

function sourceFor(sound: Sound, variation?: string): string | undefined {
  if (variation) return variation
  return sound.source?.urls[0] ?? sound.fileName
}

export function createBrowserAudioPort(
  createAudio: (source?: string) => HTMLAudioElement = (source) =>
    new Audio(source),
): AudioPort {
  const elements = new Map<string, AudioElement>()
  const listeners = new Set<(soundId: string, error: unknown) => void>()
  const elementFor = (sound: Sound, variation?: string) => {
    let element = elements.get(sound.id)
    if (!element) {
      element = createAudio(sourceFor(sound, variation)) as AudioElement
      element.preload = 'auto'
      element.addEventListener('error', () =>
        listeners.forEach((listener) => listener(sound.id, element?.error)),
      )
      elements.set(sound.id, element)
    }
    return element
  }
  const fade = (element: AudioElement, target: number, fadeMs: number) => {
    if (fadeMs === 0) {
      element.volume = target
      return
    }
    const start = element.volume
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / fadeMs)
      element.volume = start + (target - start) * progress
      if (progress < 1) element.__fadeTimer = requestAnimationFrame(tick)
    }
    element.__fadeTimer = requestAnimationFrame(tick)
  }
  return {
    load: (sound) => void elementFor(sound).load(),
    playLoop(sound, volume, fadeMs) {
      const element = elementFor(sound)
      element.loop = true
      element.volume = 0
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
      fade(element, volume, fadeMs)
    },
    playOneShot(sound, variation, volume) {
      const element = elementFor(sound, variation)
      if (element.src !== new URL(variation, window.location.href).href) {
        element.src = variation
        element.load()
      }
      element.loop = false
      element.volume = volume
      element.currentTime = 0
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
    },
    playManualOneShot(sound, variation, volume = sound.volume) {
      const element = createAudio(sourceFor(sound, variation))
      element.volume = volume
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
    },
    setVolume(soundId, volume) {
      const element = elements.get(soundId)
      if (element) element.volume = volume
    },
    stop(soundId, fadeMs) {
      const element = elements.get(soundId)
      if (!element) return
      fade(element, 0, fadeMs)
      window.setTimeout(() => element.pause(), fadeMs)
    },
    unload(soundId) {
      const element = elements.get(soundId)
      if (!element) return
      if (element.__fadeTimer) cancelAnimationFrame(element.__fadeTimer)
      element.pause()
      element.removeAttribute('src')
      element.load()
      elements.delete(soundId)
    },
    onError(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}
