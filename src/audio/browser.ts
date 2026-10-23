import type { AudioPort } from '../domain/ports'
import type { Sound } from '../domain/playback'

type AudioElement = HTMLAudioElement & { __fadeTimer?: number }

function sourceFor(sound: Sound, variation?: string): string | undefined {
  if (variation) return variation
  return sound.source?.urls[0] ?? sound.fileName
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(1, volume))
}

export function createBrowserAudioPort(
  createAudio: (source?: string) => HTMLAudioElement = (source) =>
    new Audio(source),
): AudioPort {
  const elements = new Map<string, AudioElement>()
  const listeners = new Set<(soundId: string, error: unknown) => void>()
  const listenForErrors = (sound: Sound, element: HTMLAudioElement) => {
    element.addEventListener('error', () =>
      listeners.forEach((listener) => listener(sound.id, element.error)),
    )
    return element
  }
  const elementFor = (sound: Sound, variation?: string) => {
    // Automatic one-shots need one element per variation. Reusing the element
    // that was loaded for the first sample and swapping `src` while a load or
    // play is pending can cancel the scheduled playback in real browsers.
    const key =
      sound.kind === 'one-shot' && variation
        ? `${sound.id}:${variation}`
        : sound.id
    let element = elements.get(key)
    if (!element) {
      element = createAudio(sourceFor(sound, variation)) as AudioElement
      element.preload = 'auto'
      listenForErrors(sound, element)
      elements.set(key, element)
    }
    return element
  }
  const elementsForSound = (soundId: string) =>
    [...elements.entries()].filter(
      ([key]) => key === soundId || key.startsWith(`${soundId}:`),
    )
  const fade = (element: AudioElement, target: number, fadeMs: number) => {
    if (element.__fadeTimer) cancelAnimationFrame(element.__fadeTimer)
    const safeTarget = clampVolume(target)
    if (fadeMs === 0) {
      element.volume = safeTarget
      return
    }
    const start = clampVolume(element.volume)
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / fadeMs))
      element.volume = clampVolume(start + (safeTarget - start) * progress)
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
      element.loop = false
      element.volume = clampVolume(volume)
      element.currentTime = 0
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
    },
    playManualOneShot(sound, variation, volume = sound.volume) {
      const element = listenForErrors(
        sound,
        createAudio(sourceFor(sound, variation)),
      )
      element.volume = clampVolume(volume)
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
    },
    setVolume(soundId, volume) {
      const element = elements.get(soundId)
      if (element) element.volume = clampVolume(volume)
    },
    stop(soundId, fadeMs) {
      for (const [, element] of elementsForSound(soundId)) {
        fade(element, 0, fadeMs)
        window.setTimeout(() => element.pause(), fadeMs)
      }
    },
    unload(soundId) {
      for (const [key, element] of elementsForSound(soundId)) {
        if (element.__fadeTimer) cancelAnimationFrame(element.__fadeTimer)
        element.pause()
        element.removeAttribute('src')
        element.load()
        elements.delete(key)
      }
    },
    onError(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}
