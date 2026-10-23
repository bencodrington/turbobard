import type { AudioPort, Clock, RandomSource } from './ports'
import {
  activeSounds,
  chooseVariation,
  FADE_MS,
  nextOneShotDelayMs,
  type Environment,
  type Sound,
} from './playback'

export type PlaybackCoordinator = {
  start: (environment: Environment) => void
  stop: (environment: Environment) => void
  toggleCombat: (environment: Environment) => void
  setEnvironmentVolume: (environment: Environment) => void
  setSoundVolume: (sound: Sound, environmentVolume: number) => void
  playManualOneShot: (environment: Environment, sound: Sound) => void
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
  const unsubscribe = audio.onError?.((soundId, error) =>
    onSoundError?.(soundId, error),
  )

  const clearTimer = (soundId: string) => {
    const timer = timers.get(soundId)
    if (timer !== undefined) clock.clearTimeout(timer)
    timers.delete(soundId)
  }

  const scheduleOneShot = (environment: Environment, sound: Sound) => {
    clearTimer(sound.id)
    const delay = nextOneShotDelayMs(sound, random.next())
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
  }

  const stopLoops = (environment: Environment) => {
    for (const sound of environment.sounds.filter(
      (item) => item.kind === 'loop',
    )) {
      clearTimer(sound.id)
      audio.stop(sound.id, FADE_MS)
      const unloadTimer = clock.setTimeout(
        () => audio.unload(sound.id),
        FADE_MS,
      )
      timers.set(`unload:${sound.id}`, unloadTimer)
    }
  }

  const stop = (environment: Environment) => {
    if (activeId === environment.id) activeId = undefined
    stopLoops(environment)
    for (const sound of environment.sounds.filter(
      (item) => item.kind === 'one-shot',
    )) {
      clearTimer(sound.id)
    }
    if (activeEnvironment?.id === environment.id) activeEnvironment = undefined
  }

  const start = (environment: Environment) => {
    if (activeEnvironment && activeEnvironment.id !== environment.id) {
      stop(activeEnvironment)
    }
    activeId = environment.id
    activeEnvironment = environment
    for (const sound of activeSounds(environment)) {
      clearTimer(`unload:${sound.id}`)
      audio.load(sound)
      if (sound.kind === 'loop') {
        audio.playLoop(sound, environment.volume * sound.volume, FADE_MS)
      } else {
        scheduleOneShot(environment, sound)
      }
    }
  }

  return {
    start(environment) {
      start(environment)
    },
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
    },
    activeEnvironmentId: () => activeId,
    dispose() {
      for (const soundId of timers.keys()) clearTimer(soundId)
      unsubscribe?.()
    },
  }
}
