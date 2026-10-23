import type { Environment, Sound } from './playback'

export type Clock = {
  setTimeout: (callback: () => void, delayMs: number) => unknown
  clearTimeout: (handle: unknown) => void
}
export type RandomSource = { next: () => number }
export type EnvironmentPersistence = {
  load: () => Environment[]
  save: (environments: Environment[]) => void
}
export type SoundCatalog = { search: (query: string) => Promise<Sound[]> }
export type AudioPort = {
  load: (sound: Sound) => void
  playLoop: (sound: Sound, volume: number, fadeMs: number) => void
  playOneShot: (sound: Sound, variation: string, volume: number) => void
  playManualOneShot: (sound: Sound, variation: string, volume?: number) => void
  setVolume: (soundId: string, volume: number) => void
  stop: (soundId: string, fadeMs: number) => void
  unload: (soundId: string) => void
  onError?: (callback: (soundId: string, error: unknown) => void) => () => void
}

export function deterministicRandom(values: number[]): RandomSource {
  let index = 0
  return { next: () => values[Math.min(index++, values.length - 1)] ?? 0 }
}

export function fakeClock(): Clock & { advance: (delayMs: number) => void } {
  let now = 0
  const timers: Array<{ at: number; callback: () => void }> = []
  return {
    setTimeout(callback, delayMs) {
      timers.push({ at: now + delayMs, callback })
      return callback
    },
    clearTimeout(handle) {
      const index = timers.findIndex((timer) => timer.callback === handle)
      if (index >= 0) timers.splice(index, 1)
    },
    advance(delayMs) {
      now += delayMs
      const due = timers.filter((entry) => entry.at <= now)
      for (const timer of due) timers.splice(timers.indexOf(timer), 1)
      for (const timer of due) timer.callback()
    },
  }
}
