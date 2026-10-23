import type { AudioPort, Clock, RandomSource } from './ports'
import {
  activeSounds,
  chooseVariation,
  FADE_MS,
  nextOneShotDelayMs,
  type Environment,
  type Sound,
} from './playback'

export type OneShotState = {
  soundId: string
  nextFireAtMs: number
  durationMs: number
  remainingMs: number
  fractionRemaining: number
}

export type PlaybackCoordinator = {
  start: (environment: Environment) => void
  sync: (environment: Environment) => void
  stop: (environment: Environment) => void
  toggleCombat: (environment: Environment) => void
  setEnvironmentVolume: (environment: Environment) => void
  setSoundVolume: (sound: Sound, environmentVolume: number) => void
  playManualOneShot: (environment: Environment, sound: Sound) => void
  oneShotState: (soundId: string) => OneShotState | undefined
  scheduledOneShotCount: () => number
  subscribe: (listener: () => void) => () => void
  activeEnvironmentId: () => string | undefined
  dispose: () => void
}

export function createPlaybackCoordinator({
  audio,
  clock,
  random,
  onSoundError,
}: {
  audio: AudioPort
  clock: Clock
  random: RandomSource
  onSoundError?: (soundId: string, error: unknown) => void
}): PlaybackCoordinator {
  let activeId: string | undefined
  let activeEnvironment: Environment | undefined
  const soundVolumes = new Map<string, number>()
  const timers = new Map<string, unknown>()
  const oneShotSchedules = new Map<
    string,
    { nextFireAtMs: number; durationMs: number }
  >()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  const unsubscribe = audio.onError?.((soundId, error) =>
    onSoundError?.(soundId, error),
  )

  const clearTimer = (soundId: string) => {
    const timer = timers.get(soundId)
    if (timer !== undefined) clock.clearTimeout(timer)
    timers.delete(soundId)
  }

  const clearOneShotSchedule = (soundId: string) => {
    clearTimer(soundId)
    if (oneShotSchedules.delete(soundId)) notify()
  }

  const clearUnloadTimer = (soundId: string) => {
    clearTimer(`unload:${soundId}`)
  }

  const scheduleOneShot = (environment: Environment, sound: Sound) => {
    clearOneShotSchedule(sound.id)
    const delay = nextOneShotDelayMs(sound, random.next())
    oneShotSchedules.set(sound.id, {
      nextFireAtMs: clock.now() + delay,
      durationMs: delay,
    })
    const timer = clock.setTimeout(() => {
      if (activeId !== environment.id) return
      try {
        const currentVolume =
          activeEnvironment?.id === environment.id
            ? activeEnvironment.volume
            : environment.volume
        audio.playOneShot(
          sound,
          chooseVariation(sound, random.next()),
          currentVolume * (soundVolumes.get(sound.id) ?? sound.volume),
        )
      } catch (error) {
        onSoundError?.(sound.id, error)
      }
      scheduleOneShot(environment, sound)
    }, delay)
    timers.set(sound.id, timer)
    notify()
  }

  const stopSound = (sound: Sound) => {
    clearOneShotSchedule(sound.id)
    audio.stop(sound.id, FADE_MS)
    const unloadTimer = clock.setTimeout(() => audio.unload(sound.id), FADE_MS)
    timers.set(`unload:${sound.id}`, unloadTimer)
  }

  const stopSounds = (sounds: Sound[]) => {
    for (const sound of sounds) {
      clearUnloadTimer(sound.id)
      stopSound(sound)
    }
  }

  const startSound = (environment: Environment, sound: Sound) => {
    clearUnloadTimer(sound.id)
    audio.load(sound)
    if (sound.kind === 'loop') {
      audio.playLoop(sound, environment.volume * sound.volume, FADE_MS)
    } else {
      scheduleOneShot(environment, sound)
    }
  }

  const safelyStartSound = (environment: Environment, sound: Sound) => {
    try {
      startSound(environment, sound)
    } catch (error) {
      onSoundError?.(sound.id, error)
    }
  }

  const stop = (environment: Environment) => {
    if (activeId === environment.id) activeId = undefined
    stopSounds(activeSounds(environment))
    if (activeEnvironment?.id === environment.id) activeEnvironment = undefined
  }

  const start = (environment: Environment) => {
    if (activeEnvironment && activeEnvironment.id !== environment.id) {
      stop(activeEnvironment)
    }
    activeId = environment.id
    activeEnvironment = environment
    for (const sound of activeSounds(environment)) {
      safelyStartSound(environment, sound)
    }
  }

  const sync = (environment: Environment) => {
    if (activeId !== environment.id) return
    const previous = activeEnvironment
    if (!previous) {
      start(environment)
      return
    }
    const previousSounds = new Map(
      activeSounds(previous).map((sound) => [sound.id, sound]),
    )
    const nextSounds = new Map(
      activeSounds(environment).map((sound) => [sound.id, sound]),
    )
    for (const sound of previousSounds.values()) {
      if (!nextSounds.has(sound.id)) stopSound(sound)
    }
    for (const sound of nextSounds.values()) {
      if (!previousSounds.has(sound.id)) safelyStartSound(environment, sound)
    }
    for (const sound of nextSounds.values()) {
      const previousSound = previousSounds.get(sound.id)
      if (
        previousSound?.kind === 'one-shot' &&
        sound.kind === 'one-shot' &&
        (previousSound.minIntervalSeconds !== sound.minIntervalSeconds ||
          previousSound.maxIntervalSeconds !== sound.maxIntervalSeconds)
      ) {
        scheduleOneShot(environment, sound)
      }
    }
    activeEnvironment = environment
  }

  return {
    start(environment) {
      start(environment)
    },
    sync,
    stop,
    toggleCombat(environment) {
      if (activeId !== environment.id) return
      stop(environment)
      const next = { ...environment, combatMode: !environment.combatMode }
      start(next)
    },
    setEnvironmentVolume(environment) {
      if (activeEnvironment?.id === environment.id)
        activeEnvironment = environment
      for (const sound of activeSounds(environment).filter(
        (item) => item.kind === 'loop',
      )) {
        audio.setVolume(sound.id, environment.volume * sound.volume)
      }
    },
    setSoundVolume(sound, environmentVolume) {
      soundVolumes.set(sound.id, sound.volume)
      audio.setVolume(sound.id, environmentVolume * sound.volume)
    },
    playManualOneShot(environment, sound) {
      audio.playManualOneShot(
        sound,
        chooseVariation(sound, random.next()),
        environment.volume * sound.volume,
      )
      if (
        activeId === environment.id &&
        oneShotSchedules.has(sound.id) &&
        activeEnvironment?.sounds.some((item) => item.id === sound.id)
      ) {
        scheduleOneShot(environment, sound)
      }
    },
    oneShotState(soundId) {
      const schedule = oneShotSchedules.get(soundId)
      if (!schedule) return undefined
      const remainingMs = Math.max(0, schedule.nextFireAtMs - clock.now())
      return {
        soundId,
        ...schedule,
        remainingMs,
        fractionRemaining:
          schedule.durationMs === 0
            ? 0
            : Math.min(1, Math.max(0, remainingMs / schedule.durationMs)),
      }
    },
    scheduledOneShotCount: () => oneShotSchedules.size,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    activeEnvironmentId: () => activeId,
    dispose() {
      for (const soundId of timers.keys()) clearTimer(soundId)
      oneShotSchedules.clear()
      listeners.clear()
      unsubscribe?.()
    },
  }
}
