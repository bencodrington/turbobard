import type { EnvironmentPersistence } from '../domain/ports'
import type { PlaybackCoordinator } from '../domain/coordinator'
import {
  createEnvironment,
  deleteEnvironment,
  renameEnvironment,
  setEnvironmentIcon,
  setEnvironmentIconColor,
} from '../domain/environments'
import type { Environment, Sound } from '../domain/playback'

export type EnvironmentWorkspaceState = {
  environments: Environment[]
}

export type EnvironmentWorkspace = {
  getSnapshot: () => EnvironmentWorkspaceState
  subscribe: (listener: () => void) => () => void
  addEnvironment: () => Environment
  renameEnvironment: (environmentId: string, name: string) => void
  removeEnvironment: (environmentId: string) => void
  setIcon: (environmentId: string, icon: string | null) => void
  setIconColor: (environmentId: string, iconColor: string | null) => void
  updateSounds: (environmentId: string, sounds: Sound[]) => void
  setEnvironmentVolume: (environmentId: string, volume: number) => void
  setSoundVolume: (
    environmentId: string,
    soundId: string,
    volume: number,
  ) => void
  setSoundTiming: (
    environmentId: string,
    soundId: string,
    minimum: number,
    maximum: number,
  ) => void
  play: (environmentId: string) => void
  stop: (environmentId: string) => void
  toggleCombat: (environmentId: string) => void
  playManualOneShot: (environmentId: string, soundId: string) => void
}

export function createEnvironmentWorkspace({
  persistence,
  playback,
  createId,
}: {
  persistence: EnvironmentPersistence
  playback: PlaybackCoordinator
  createId: () => string
}): EnvironmentWorkspace {
  let state: EnvironmentWorkspaceState = { environments: persistence.load() }
  const listeners = new Set<() => void>()

  const notify = () => listeners.forEach((listener) => listener())
  const environmentFor = (environmentId: string) =>
    state.environments.find((environment) => environment.id === environmentId)

  const replace = (environments: Environment[]) => {
    state = { environments }
    persistence.save(environments)
    notify()
  }

  const updateEnvironment = (
    environmentId: string,
    update: (environment: Environment) => Environment,
  ) => {
    const environment = environmentFor(environmentId)
    if (!environment) return
    replace(
      state.environments.map((item) =>
        item.id === environmentId ? update(item) : item,
      ),
    )
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    addEnvironment() {
      const environment = createEnvironment(createId(), 'New Environment')
      replace([...state.environments, environment])
      return environment
    },
    renameEnvironment(environmentId, name) {
      updateEnvironment(environmentId, (environment) =>
        renameEnvironment(environment, name),
      )
    },
    removeEnvironment(environmentId) {
      const environment = environmentFor(environmentId)
      if (environment?.playing) playback.stop(environment)
      replace(deleteEnvironment(state.environments, environmentId))
    },
    setIcon(environmentId, icon) {
      updateEnvironment(environmentId, (environment) =>
        setEnvironmentIcon(environment, icon),
      )
    },
    setIconColor(environmentId, iconColor) {
      updateEnvironment(environmentId, (environment) =>
        setEnvironmentIconColor(environment, iconColor),
      )
    },
    updateSounds(environmentId, sounds) {
      updateEnvironment(environmentId, (environment) => {
        const next = { ...environment, sounds }
        if (environment.playing) playback.sync(next)
        return next
      })
    },
    setEnvironmentVolume(environmentId, volume) {
      updateEnvironment(environmentId, (environment) => {
        const next = { ...environment, volume }
        if (environment.playing) playback.setEnvironmentVolume(next)
        return next
      })
    },
    setSoundVolume(environmentId, soundId, volume) {
      updateEnvironment(environmentId, (environment) => {
        const sounds = environment.sounds.map((sound) =>
          sound.id === soundId ? { ...sound, volume } : sound,
        )
        const next = { ...environment, sounds }
        if (environment.playing) {
          const sound = sounds.find((item) => item.id === soundId)
          if (sound) playback.setSoundVolume(sound, environment.volume)
        }
        return next
      })
    },
    setSoundTiming(environmentId, soundId, minimum, maximum) {
      updateEnvironment(environmentId, (environment) => {
        const sounds = environment.sounds.map((sound) =>
          sound.id === soundId
            ? {
                ...sound,
                minIntervalSeconds: Math.max(0, minimum),
                maxIntervalSeconds: Math.max(Math.max(0, minimum), maximum),
              }
            : sound,
        )
        const next = { ...environment, sounds }
        if (environment.playing) playback.sync(next)
        return next
      })
    },
    play(environmentId) {
      const environment = environmentFor(environmentId)
      if (!environment) return
      const current = state.environments.find((item) => item.playing)
      if (current && current.id !== environment.id) playback.stop(current)
      playback.start(environment)
      replace(
        state.environments.map((item) => ({
          ...item,
          playing: item.id === environment.id,
        })),
      )
    },
    stop(environmentId) {
      const environment = environmentFor(environmentId)
      if (!environment) return
      playback.stop(environment)
      replace(
        state.environments.map((item) =>
          item.id === environmentId ? { ...item, playing: false } : item,
        ),
      )
    },
    toggleCombat(environmentId) {
      const environment = environmentFor(environmentId)
      if (!environment) return
      const next = { ...environment, combatMode: !environment.combatMode }
      if (environment.playing) playback.toggleCombat(environment)
      replace(
        state.environments.map((item) =>
          item.id === environmentId ? next : item,
        ),
      )
    },
    playManualOneShot(environmentId, soundId) {
      const environment = environmentFor(environmentId)
      const sound = environment?.sounds.find((item) => item.id === soundId)
      if (environment && sound) playback.playManualOneShot(environment, sound)
    },
  }
}
