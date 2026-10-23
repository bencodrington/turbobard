export type SoundKind = 'loop' | 'one-shot'
export type Placement = 'ambiance' | 'combat'

export type Sound = {
  id: string
  kind: SoundKind
  placement: Placement
  volume: number
  variations?: string[]
  minIntervalSeconds?: number
  maxIntervalSeconds?: number
  loaded?: boolean
}

export type Environment = {
  id: string
  name: string
  volume: number
  sounds: Sound[]
  playing: boolean
  combatMode: boolean
}

export type AudioCommand =
  | { type: 'stop-environment'; environmentId: string; fadeMs: number }
  | {
      type: 'play-loop'
      environmentId: string
      soundId: string
      volume: number
      fadeMs: number
    }
  | {
      type: 'schedule-one-shot'
      environmentId: string
      soundId: string
      delayMs: number
    }
  | {
      type: 'play-one-shot'
      environmentId: string
      soundId: string
      variation: string
      manual: boolean
    }
  | { type: 'unload-sound'; soundId: string }

export type PlaybackDependencies = {
  random: () => number
  schedule: (callback: () => void, delayMs: number) => unknown
  audio: { playManualOneShot: (sound: Sound, variation: string) => void }
}

export const FADE_MS = 2_000

export function activeSounds(environment: Environment): Sound[] {
  const music = environment.sounds.filter(
    (sound) => sound.kind === 'loop' && sound.placement === 'ambiance',
  )
  const combatMusic = environment.sounds.filter(
    (sound) => sound.kind === 'loop' && sound.placement === 'combat',
  )
  const ambiance = environment.sounds.filter(
    (sound) => sound.kind === 'one-shot' && sound.placement === 'ambiance',
  )
  const combatAmbiance = environment.sounds.filter(
    (sound) => sound.kind === 'one-shot' && sound.placement === 'combat',
  )
  if (!environment.combatMode) return [...music, ...ambiance]
  return [
    ...(combatMusic.length ? combatMusic : music),
    ...ambiance,
    ...combatAmbiance,
  ]
}

export function restoreEnvironment(
  raw: Partial<Environment> & { combatTracks?: Sound[] },
  createId: () => string = () => 'restored-environment',
): Environment {
  return {
    id: raw.id ?? createId(),
    name: raw.name ?? 'Untitled Environment',
    volume: raw.volume ?? 1,
    sounds: [...(raw.sounds ?? []), ...(raw.combatTracks ?? [])].map(
      (sound) => ({ ...sound, loaded: false }),
    ),
    playing: false,
    combatMode: false,
  }
}

export function nextOneShotDelayMs(sound: Sound, random: number): number {
  const min = sound.minIntervalSeconds ?? 0
  const max = sound.maxIntervalSeconds ?? min
  return (min + (max - min) * random) * 1_000
}

export function chooseVariation(sound: Sound, random: number): string {
  const variations = sound.variations ?? []
  if (!variations.length) throw new Error(`Sound ${sound.id} has no variations`)
  return variations[
    Math.min(variations.length - 1, Math.floor(random * variations.length))
  ]
}

export function startEnvironment(
  environment: Environment,
  previouslyPlayingId: string | undefined,
  dependencies: PlaybackDependencies,
): AudioCommand[] {
  const commands: AudioCommand[] = []
  if (previouslyPlayingId && previouslyPlayingId !== environment.id) {
    commands.push({
      type: 'stop-environment',
      environmentId: previouslyPlayingId,
      fadeMs: FADE_MS,
    })
  }
  for (const sound of activeSounds(environment)) {
    if (sound.kind === 'loop') {
      commands.push({
        type: 'play-loop',
        environmentId: environment.id,
        soundId: sound.id,
        volume: environment.volume * sound.volume,
        fadeMs: FADE_MS,
      })
    } else {
      commands.push({
        type: 'schedule-one-shot',
        environmentId: environment.id,
        soundId: sound.id,
        delayMs: nextOneShotDelayMs(sound, dependencies.random()),
      })
    }
  }
  return commands
}

export function playManualOneShot(
  environmentId: string,
  sound: Sound,
  dependencies: PlaybackDependencies,
): AudioCommand {
  const variation = chooseVariation(sound, dependencies.random())
  dependencies.audio.playManualOneShot(sound, variation)
  return {
    type: 'play-one-shot',
    environmentId,
    soundId: sound.id,
    variation,
    manual: true,
  }
}

export function stopEnvironment(environment: Environment): AudioCommand[] {
  return environment.sounds
    .filter((sound) => sound.kind === 'loop')
    .flatMap((sound) => [
      {
        type: 'stop-environment' as const,
        environmentId: environment.id,
        fadeMs: FADE_MS,
      },
      { type: 'unload-sound' as const, soundId: sound.id },
    ])
}
