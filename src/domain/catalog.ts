import type { Placement, Sound, SoundKind } from './playback'

export type CatalogFilter = 'everything' | 'music' | 'ambiance'

export type CatalogItem = {
  id: string
  name: string
  kind: SoundKind
  source?: { author?: string; urls: string[] }
  tags?: string[]
  variations?: string[]
  minIntervalSeconds?: number
  maxIntervalSeconds?: number
  packId?: string
  packName?: string
}

export type SoundCatalog = {
  search: (query: string, filter: CatalogFilter) => Promise<CatalogItem[]>
}

export function catalogMatches(
  item: CatalogItem,
  query: string,
  filter: CatalogFilter,
): boolean {
  const haystack = [item.name, ...(item.tags ?? [])].join(' ').toLowerCase()
  const matchesQuery = haystack.includes(query.trim().toLowerCase())
  const matchesFilter =
    filter === 'everything' ||
    (filter === 'music' && item.kind === 'loop') ||
    (filter === 'ambiance' && item.kind === 'one-shot')
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
      volume: 1,
      source: item.source,
      tags: item.tags,
      variations: item.variations,
      minIntervalSeconds: item.minIntervalSeconds,
      maxIntervalSeconds: item.maxIntervalSeconds,
      loaded: false,
    },
  ]
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
