import type { Placement, Sound, SoundKind } from './playback'

export type CatalogFilter = 'everything' | 'music' | 'ambiance'

export type CatalogItem = {
  id: string
  name: string
  kind: SoundKind
  volume?: number
  source?: { author?: string; urls: string[] }
  attributionUrls?: string[]
  tags?: string[]
  variations?: string[]
  minIntervalSeconds?: number
  maxIntervalSeconds?: number
  packId?: string
  packName?: string
}

export type CatalogPack = {
  id: string
  name: string
  kind: 'pack'
  tags?: string[]
  items: CatalogItem[]
}

export type CatalogResult = CatalogItem | CatalogPack

export type SoundCatalog = {
  search: (query: string, filter: CatalogFilter) => Promise<CatalogResult[]>
}

export function isCatalogMusic(item: CatalogItem): boolean {
  return item.tags?.includes('music') ?? false
}

export function catalogMatches(
  item: CatalogResult,
  query: string,
  filter: CatalogFilter,
): boolean {
  const haystack = [item.name, ...(item.tags ?? [])].join(' ').toLowerCase()
  const matchesQuery = haystack.includes(query.trim().toLowerCase())
  const matchesFilter =
    filter === 'everything' ||
    (item.kind !== 'pack' &&
      (filter === 'music' ? isCatalogMusic(item) : !isCatalogMusic(item)))
  return matchesQuery && matchesFilter
}

export function addCatalogItem(
  sounds: Sound[],
  item: CatalogItem,
  placement: Placement = 'ambiance',
): Sound[] {
  if (sounds.some((sound) => sound.id === item.id)) return sounds
  return [
    ...sounds,
    {
      id: item.id,
      name: item.name,
      kind: item.kind,
      placement,
      volume: item.volume ?? 1,
      source: item.source,
      attributionUrls: item.attributionUrls,
      tags: item.tags,
      variations: item.variations,
      minIntervalSeconds: item.minIntervalSeconds,
      maxIntervalSeconds: item.maxIntervalSeconds,
      loaded: false,
    },
  ]
}

export function isCatalogResultAdded(
  sounds: Sound[],
  result: CatalogResult,
): boolean {
  const items = result.kind === 'pack' ? result.items : [result]
  return (
    items.length > 0 &&
    items.every((item) => sounds.some((sound) => sound.id === item.id))
  )
}

export function toggleCatalogResult(
  sounds: Sound[],
  result: CatalogResult,
  placement: Placement = 'ambiance',
): Sound[] {
  const items = result.kind === 'pack' ? result.items : [result]
  if (isCatalogResultAdded(sounds, result)) {
    const ids = new Set(items.map((item) => item.id))
    return sounds.filter((sound) => !ids.has(sound.id))
  }
  return addCatalogPack(sounds, items, placement)
}

export function addCatalogPack(
  sounds: Sound[],
  items: CatalogItem[],
  placement: Placement = 'ambiance',
): Sound[] {
  return items.reduce(
    (next, item) => addCatalogItem(next, item, placement),
    sounds,
  )
}

export function removeSound(sounds: Sound[], soundId: string): Sound[] {
  return sounds.filter((sound) => sound.id !== soundId)
}

export function placeSound(
  sounds: Sound[],
  soundId: string,
  placement: Placement,
): Sound[] {
  return sounds.map((sound) =>
    sound.id === soundId ? { ...sound, placement } : sound,
  )
}

export function setSoundTiming(
  sounds: Sound[],
  soundId: string,
  minIntervalSeconds: number,
  maxIntervalSeconds: number,
): Sound[] {
  const minimum = Math.max(0, minIntervalSeconds)
  const maximum = Math.max(minimum, maxIntervalSeconds)
  return sounds.map((sound) =>
    sound.id === soundId
      ? { ...sound, minIntervalSeconds: minimum, maxIntervalSeconds: maximum }
      : sound,
  )
}
