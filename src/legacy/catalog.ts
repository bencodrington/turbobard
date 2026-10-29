import type {
  CatalogItem,
  CatalogResult,
  SoundCatalog,
} from '../domain/catalog'

const DEFAULT_API_BASE_URL = 'https://us-central1-turbo-bard.cloudfunctions.net'
const DEFAULT_STORAGE_BASE_URL =
  'https://storage.googleapis.com/turbo-bard.appspot.com'

type LegacySearchResult = {
  id?: unknown
  name?: unknown
  tags?: unknown
  type?: unknown
  tracks?: unknown
}

type LegacyPackMember = {
  id: string
  volume?: number
  oneShotConfig?: {
    minSecondsBetween?: number
    maxSecondsBetween?: number
  }
}

function packMembers(value: unknown): LegacyPackMember[] {
  if (
    !Array.isArray(value) ||
    value.some((member) => !member || typeof member.id !== 'string')
  ) {
    throw new Error('Legacy API returned an invalid pack')
  }
  return value as LegacyPackMember[]
}

type LegacyTrack = LegacySearchResult & {
  source?: { author?: unknown; urls?: unknown }
  fileName?: unknown
  samples?: unknown
  minSecondsBetween?: unknown
  maxSecondsBetween?: unknown
}

function envValue(name: string): string | undefined {
  const value = import.meta.env[name] as string | undefined
  return value?.trim() || undefined
}

function apiUrl(path: string, params: Record<string, string>): string {
  const base = envValue('VITE_LEGACY_API_BASE_URL') ?? DEFAULT_API_BASE_URL
  const url = new URL(path, `${base.replace(/\/$/, '')}/`)
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  )
  return url.toString()
}

function storageUrl(fileName: string): string {
  const base =
    envValue('VITE_LEGACY_STORAGE_BASE_URL') ?? DEFAULT_STORAGE_BASE_URL
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(fileName)}.mp3`
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function isTrackResult(result: LegacySearchResult): boolean {
  return result.type === 'LOOP' || result.type === 'ONESHOT'
}

function mapTrack(track: LegacyTrack): CatalogItem {
  if (typeof track.id !== 'string' || typeof track.name !== 'string') {
    throw new Error('Legacy API returned an invalid track')
  }

  const kind = track.type === 'ONESHOT' ? 'one-shot' : 'loop'
  const fileName = typeof track.fileName === 'string' ? track.fileName : ''
  const variations = stringArray(track.samples).map(storageUrl)
  const sourceUrls = fileName ? [storageUrl(fileName)] : variations
  if (!sourceUrls.length) {
    throw new Error(`Legacy track ${track.id} has no playable source`)
  }

  const source = {
    author:
      typeof track.source?.author === 'string'
        ? track.source.author
        : undefined,
    urls: sourceUrls,
  }
  const item: CatalogItem = {
    id: track.id,
    name: track.name,
    kind,
    source,
    tags: stringArray(track.tags),
  }
  if (variations.length) item.variations = variations
  if (kind === 'one-shot') {
    item.minIntervalSeconds =
      typeof track.minSecondsBetween === 'number'
        ? track.minSecondsBetween
        : undefined
    item.maxIntervalSeconds =
      typeof track.maxSecondsBetween === 'number'
        ? track.maxSecondsBetween
        : undefined
  }
  return item
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Legacy API request failed (${response.status})`)
  return (await response.json()) as T
}

export function createLegacySoundCatalog(): SoundCatalog {
  return {
    async search(query, filter) {
      const trimmedQuery = query.trim()
      if (!trimmedQuery) return []
      const searchResultType = filter.toUpperCase()
      const results = await json<LegacySearchResult[]>(
        apiUrl('/search_v3', {
          searchText: trimmedQuery,
          searchResultType,
        }),
      )
      const tracks = new Map<string, Promise<CatalogItem>>()
      const fetchTrack = (id: string) => {
        let track = tracks.get(id)
        if (!track) {
          track = json<LegacyTrack>(
            apiUrl(
              envValue('VITE_LEGACY_TRACK_ENDPOINT') ??
                '/fetchTrackDataById_v2',
              { trackId: id },
            ),
          ).then(mapTrack)
          tracks.set(id, track)
        }
        return track
      }
      return Promise.all(
        results
          .filter(
            (result) =>
              isTrackResult(result) ||
              (result.type === 'PACK' && filter === 'everything'),
          )
          .map(async (result): Promise<CatalogResult> => {
            if (
              typeof result.id !== 'string' ||
              typeof result.name !== 'string'
            ) {
              throw new Error('Legacy API returned an invalid search result')
            }
            if (result.type !== 'PACK') return fetchTrack(result.id)
            const members = packMembers(result.tracks)
            return {
              id: result.id,
              name: result.name,
              kind: 'pack',
              tags: stringArray(result.tags),
              items: await Promise.all(
                members.map(async (member) => {
                  const item = await fetchTrack(member.id)
                  return {
                    ...item,
                    volume:
                      typeof member.volume === 'number'
                        ? member.volume
                        : undefined,
                    minIntervalSeconds:
                      member.oneShotConfig?.minSecondsBetween ??
                      item.minIntervalSeconds,
                    maxIntervalSeconds:
                      member.oneShotConfig?.maxSecondsBetween ??
                      item.maxIntervalSeconds,
                  }
                }),
              ),
            }
          }),
      )
    },
  }
}
