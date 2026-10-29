import type { AudioPort } from '../domain/ports'
import type { Sound } from '../domain/playback'

type AudioElement = HTMLAudioElement & {
  __fadeTimer?: number
  __stopTimer?: number
}

function sourceFor(
  sound: Sound,
  variation?: string,
  canPlayType?: (mimeType: string) => string,
): string | undefined {
  if (variation) return variation
  const urls = sound.source?.urls ?? []
  const webm = urls.find((url) => /\.webm(?:$|[?#])/i.test(url))
  if (webm && canPlayType?.('audio/webm')) return webm
  return (
    urls.find((url) => /\.mp3(?:$|[?#])/i.test(url)) ??
    urls[0] ??
    sound.fileName
  )
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(1, volume))
}

export function createBrowserAudioPort(
  createAudio: (source?: string) => HTMLAudioElement = (source) =>
    new Audio(source),
  createAudioContext: () => AudioContext | undefined = () => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    return AudioContextConstructor ? new AudioContextConstructor() : undefined
  },
): AudioPort {
  const elements = new Map<string, AudioElement>()
  const gainNodes = new WeakMap<HTMLAudioElement, GainNode>()
  const listeners = new Set<(soundId: string, error: unknown) => void>()
  const probe =
    typeof document === 'undefined'
      ? undefined
      : document.createElement('audio')
  const canPlayType = probe?.canPlayType.bind(probe)
  const canSetElementVolume = (() => {
    if (!probe) return true
    const original = probe.volume
    const check = original === 0 ? 1 : 0
    try {
      probe.volume = check
      return probe.volume === check
    } catch {
      return false
    } finally {
      try {
        probe.volume = original
      } catch {
        // Some browsers expose the property as read-only.
      }
    }
  })()
  let audioContext: AudioContext | undefined
  const gainFor = (element: AudioElement) => {
    if (canSetElementVolume) return undefined
    const existing = gainNodes.get(element)
    if (existing) return existing
    try {
      audioContext ??= createAudioContext()
      if (!audioContext) return undefined
      const source = audioContext.createMediaElementSource(element)
      const gain = audioContext.createGain()
      source.connect(gain)
      gain.connect(audioContext.destination)
      gainNodes.set(element, gain)
      return gain
    } catch {
      return undefined
    }
  }
  const resumeAudioContext = (soundId: string) => {
    if (audioContext?.state !== 'suspended') return
    void audioContext
      .resume()
      .catch((error) =>
        listeners.forEach((listener) => listener(soundId, error)),
      )
  }
  const setLevel = (element: AudioElement, volume: number) => {
    const safeVolume = clampVolume(volume)
    const gain = gainFor(element)
    if (gain) gain.gain.value = safeVolume
    else element.volume = safeVolume
  }
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
      const source = sourceFor(sound, variation, canPlayType)
      element = (
        canSetElementVolume ? createAudio(source) : createAudio()
      ) as AudioElement
      if (!canSetElementVolume) {
        // MediaElementSource needs a CORS-enabled request. Set this before src
        // so the request can be routed through Web Audio on iOS.
        element.crossOrigin = 'anonymous'
        if (source) element.src = source
      }
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
      setLevel(element, safeTarget)
      return
    }
    const gain = gainFor(element)
    const start = clampVolume(gain?.gain.value ?? element.volume)
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - started) / fadeMs))
      setLevel(element, start + (safeTarget - start) * progress)
      if (progress < 1) element.__fadeTimer = requestAnimationFrame(tick)
    }
    element.__fadeTimer = requestAnimationFrame(tick)
  }
  const cancelStop = (element: AudioElement) => {
    if (element.__stopTimer) window.clearTimeout(element.__stopTimer)
    element.__stopTimer = undefined
  }
  return {
    load: (sound) => void elementFor(sound).load(),
    playLoop(sound, volume, fadeMs) {
      const element = elementFor(sound)
      cancelStop(element)
      element.loop = true
      setLevel(element, 0)
      resumeAudioContext(sound.id)
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
      fade(element, volume, fadeMs)
    },
    playOneShot(sound, variation, volume) {
      const element = elementFor(sound, variation)
      cancelStop(element)
      element.loop = false
      setLevel(element, volume)
      resumeAudioContext(sound.id)
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
        (() => {
          const source = sourceFor(sound, variation, canPlayType)
          if (canSetElementVolume) return createAudio(source)
          const audio = createAudio() as AudioElement
          audio.crossOrigin = 'anonymous'
          if (source) audio.src = source
          return audio
        })(),
      )
      setLevel(element as AudioElement, volume)
      resumeAudioContext(sound.id)
      void element
        .play()
        .catch((error) =>
          listeners.forEach((listener) => listener(sound.id, error)),
        )
    },
    setVolume(soundId, volume) {
      const element = elements.get(soundId)
      if (element) setLevel(element, volume)
    },
    stop(soundId, fadeMs) {
      for (const [, element] of elementsForSound(soundId)) {
        cancelStop(element)
        fade(element, 0, fadeMs)
        element.__stopTimer = window.setTimeout(() => {
          element.__stopTimer = undefined
          element.pause()
        }, fadeMs)
      }
    },
    unload(soundId) {
      for (const [key, element] of elementsForSound(soundId)) {
        cancelStop(element)
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
