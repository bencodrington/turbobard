export type SoundKind = 'loop' | 'one-shot'
export type Placement = 'ambiance' | 'combat'

export type Sound = {
  id: string
  kind: SoundKind
  placement: Placement
  volume: number
  index?: number
  name?: string
  source?: { author?: string; urls: string[] }
  tags?: string[]
  fileName?: string
  muted?: boolean
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
  expanded: boolean
  icon: string | null
  iconColor: string | null
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
  raw: Partial<Environment>,
  createId: () => string = () => 'restored-environment',
): Environment {
  return {
    id: raw.id ?? createId(),
    name: raw.name ?? 'Untitled Environment',
    volume: raw.volume ?? 1,
    expanded: raw.expanded ?? true,
    icon: raw.icon ?? null,
    iconColor: raw.iconColor ?? null,
    sounds: (raw.sounds ?? []).map((sound) => ({ ...sound, loaded: false })),
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
