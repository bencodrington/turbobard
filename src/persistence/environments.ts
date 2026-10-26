import type {
  Environment,
  Placement,
  Sound,
  SoundKind,
} from '../domain/playback'
import type { EnvironmentPersistence } from '../domain/ports'

export const LEGACY_GROUPS_KEY = 'groups'
export const VERSIONED_ENVIRONMENTS_KEY = 'environments'
const VERSION = 1

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
type LegacyTrack = {
  id?: unknown
  index?: unknown
  name?: unknown
  source?: unknown
  tags?: unknown
  type?: unknown
  fileName?: unknown
  samples?: unknown
  volume?: unknown
  isMuted?: unknown
  minSecondsBetween?: unknown
  maxSecondsBetween?: unknown
}
type LegacyGroup = {
  id?: unknown
  index?: unknown
  name?: unknown
  tracks?: unknown
  combatTracks?: unknown
  volume?: unknown
  icon?: unknown
  iconColour?: unknown
}

type VersionedDocument = {
  version: typeof VERSION
  environments: Environment[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

function parseJson(storage: StorageLike, key: string): unknown {
  const value = storage.getItem(key)
  if (value === null) return undefined
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function soundKind(track: LegacyTrack): SoundKind {
  if (Array.isArray(track.samples)) return 'one-shot'
  return track.type === 'ONESHOT' || track.type === 'one-shot'
    ? 'one-shot'
    : 'loop'
}

function migrateTrack(track: LegacyTrack, placement: Placement): Sound {
  const kind = soundKind(track)
  const sound: Sound = {
    id: asString(track.id, 'unknown-sound'),
    index: asNumber(track.index, 0),
    kind,
    placement,
    volume: asNumber(track.volume, 1),
    muted: asBoolean(track.isMuted, false),
    loaded: false,
  }
  if (typeof track.name === 'string') sound.name = track.name
  if (isRecord(track.source) && Array.isArray(track.source.urls)) {
    sound.source = {
      ...(typeof track.source.author === 'string'
        ? { author: track.source.author }
        : {}),
      urls: track.source.urls.filter(
        (url): url is string => typeof url === 'string',
      ),
    }
  }
  if (Array.isArray(track.tags)) {
    sound.tags = track.tags.filter(
      (tag): tag is string => typeof tag === 'string',
    )
  }
  if (kind === 'loop' && typeof track.fileName === 'string') {
    sound.fileName = track.fileName
  }
  if (kind === 'one-shot') {
    sound.variations = Array.isArray(track.samples)
      ? track.samples.filter(
          (sample): sample is string => typeof sample === 'string',
        )
      : []
    sound.minIntervalSeconds = asNumber(track.minSecondsBetween, 5)
    sound.maxIntervalSeconds = asNumber(track.maxSecondsBetween, 10)
  }
  return sound
}

function migrateGroup(group: LegacyGroup, fallbackId: string): Environment {
  const tracks = Array.isArray(group.tracks) ? group.tracks : []
  const combatTracks = Array.isArray(group.combatTracks)
    ? group.combatTracks
    : []
  return {
    id:
      typeof group.id === 'string'
        ? group.id
        : typeof group.index === 'number'
          ? `environment-${group.index}`
          : fallbackId,
    name: asString(group.name, 'Untitled environment'),
    volume: asNumber(group.volume, 1),
    icon: typeof group.icon === 'string' ? group.icon : null,
    iconColor: typeof group.iconColour === 'string' ? group.iconColour : null,
    playing: false,
    combatMode: false,
    sounds: [
      ...tracks
        .filter(isRecord)
        .map((track) => migrateTrack(track as LegacyTrack, 'ambiance')),
      ...combatTracks
        .filter(isRecord)
        .map((track) => migrateTrack(track as LegacyTrack, 'combat')),
    ],
  }
}

function normalizeEnvironment(
  value: unknown,
  fallbackId: string,
): Environment | undefined {
  if (!isRecord(value)) return undefined
  const sounds = Array.isArray(value.sounds) ? value.sounds : []
  return {
    id: asString(value.id, fallbackId),
    name: asString(value.name, 'Untitled environment'),
    volume: asNumber(value.volume, 1),
    icon: typeof value.icon === 'string' ? value.icon : null,
    iconColor: typeof value.iconColor === 'string' ? value.iconColor : null,
    playing: false,
    combatMode: false,
    sounds: sounds.filter(isRecord).map(normalizeSound),
  }
}

function normalizeSound(sound: Record<string, unknown>): Sound {
  return {
    id: asString(sound.id, 'unknown-sound'),
    kind: sound.kind === 'one-shot' ? 'one-shot' : 'loop',
    placement: sound.placement === 'combat' ? 'combat' : 'ambiance',
    volume: asNumber(sound.volume, 1),
    ...(typeof sound.index === 'number' ? { index: sound.index } : {}),
    ...(typeof sound.name === 'string' ? { name: sound.name } : {}),
    ...(isRecord(sound.source) && Array.isArray(sound.source.urls)
      ? {
          source: {
            ...(typeof sound.source.author === 'string'
              ? { author: sound.source.author }
              : {}),
            urls: sound.source.urls.filter(
              (url): url is string => typeof url === 'string',
            ),
          },
        }
      : {}),
    ...(Array.isArray(sound.tags)
      ? {
          tags: sound.tags.filter(
            (tag): tag is string => typeof tag === 'string',
          ),
        }
      : {}),
    ...(typeof sound.fileName === 'string' ? { fileName: sound.fileName } : {}),
    ...(typeof sound.muted === 'boolean' ? { muted: sound.muted } : {}),
    ...(Array.isArray(sound.variations)
      ? {
          variations: sound.variations.filter(
            (variation): variation is string => typeof variation === 'string',
          ),
        }
      : {}),
    ...(typeof sound.minIntervalSeconds === 'number'
      ? { minIntervalSeconds: sound.minIntervalSeconds }
      : {}),
    ...(typeof sound.maxIntervalSeconds === 'number'
      ? { maxIntervalSeconds: sound.maxIntervalSeconds }
      : {}),
    loaded: false,
  }
}

function parseVersioned(value: unknown): Environment[] | undefined {
  if (
    !isRecord(value) ||
    value.version !== VERSION ||
    !Array.isArray(value.environments)
  ) {
    return undefined
  }
  return value.environments
    .map((environment, index) =>
      normalizeEnvironment(environment, `environment-${index}`),
    )
    .filter(
      (environment): environment is Environment => environment !== undefined,
    )
}

export function serializeEnvironments(environments: Environment[]): string {
  const document: VersionedDocument = {
    version: VERSION,
    environments: environments.map((environment) => ({
      id: environment.id,
      name: environment.name,
      volume: environment.volume,
      icon: environment.icon,
      iconColor: environment.iconColor,
      playing: false,
      combatMode: false,
      sounds: environment.sounds.map(serializeSound),
    })),
  }
  return JSON.stringify(document)
}

function serializeSound(sound: Sound): Sound {
  return {
    id: sound.id,
    kind: sound.kind,
    placement: sound.placement,
    volume: sound.volume,
    ...(sound.index === undefined ? {} : { index: sound.index }),
    ...(sound.name === undefined ? {} : { name: sound.name }),
    ...(sound.source === undefined ? {} : { source: sound.source }),
    ...(sound.tags === undefined ? {} : { tags: sound.tags }),
    ...(sound.fileName === undefined ? {} : { fileName: sound.fileName }),
    ...(sound.muted === undefined ? {} : { muted: sound.muted }),
    ...(sound.variations === undefined ? {} : { variations: sound.variations }),
    ...(sound.minIntervalSeconds === undefined
      ? {}
      : { minIntervalSeconds: sound.minIntervalSeconds }),
    ...(sound.maxIntervalSeconds === undefined
      ? {}
      : { maxIntervalSeconds: sound.maxIntervalSeconds }),
    loaded: false,
  }
}

export function createEnvironmentPersistence(
  storage: StorageLike,
  key = VERSIONED_ENVIRONMENTS_KEY,
): EnvironmentPersistence {
  return {
    load() {
      const versioned = parseVersioned(parseJson(storage, key))
      if (versioned !== undefined) return versioned

      const legacy = parseJson(storage, LEGACY_GROUPS_KEY)
      if (!Array.isArray(legacy)) return []
      const migrated = legacy
        .filter(isRecord)
        .map((group, index) =>
          migrateGroup(group as LegacyGroup, `environment-${index}`),
        )
      storage.setItem(key, serializeEnvironments(migrated))
      return migrated
    },
    save(environments) {
      storage.setItem(key, serializeEnvironments(environments))
    },
  }
}
