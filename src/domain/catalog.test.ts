import { describe, expect, it } from 'vitest'
import {
  addCatalogItem,
  addCatalogPack,
  catalogMatches,
  placeSound,
  removeSound,
  setSoundTiming,
  toggleCatalogResult,
  isCatalogResultAdded,
} from './catalog'
import type { CatalogItem } from './catalog'

const music: CatalogItem = {
  id: 'rain',
  name: 'Rain Music',
  kind: 'loop',
  tags: ['weather', 'music'],
}
const thunder: CatalogItem = {
  id: 'thunder',
  name: 'Thunder',
  kind: 'one-shot',
  tags: ['weather'],
}

describe('Sound catalog composition', () => {
  it('filters catalog items by query and Everything, Music, or Ambiance', () => {
    expect(catalogMatches(music, 'rain', 'everything')).toBe(true)
    expect(catalogMatches(music, 'rain', 'music')).toBe(true)
    expect(catalogMatches(music, 'rain', 'ambiance')).toBe(false)
    expect(catalogMatches(thunder, 'weather', 'ambiance')).toBe(true)
  })

  it('adds an individual Sound once with a chosen placement', () => {
    const sounds = addCatalogItem([], music, 'combat')
    expect(addCatalogItem(sounds, music, 'ambiance')).toHaveLength(1)
    expect(sounds[0]).toMatchObject({
      id: 'rain',
      placement: 'combat',
      loaded: false,
    })
  })

  it('adds every Sound in a pack and supports placement and removal', () => {
    const sounds = addCatalogPack([], [music, thunder])
    expect(placeSound(sounds, 'thunder', 'combat')).toEqual([
      expect.objectContaining({ id: 'rain', placement: 'ambiance' }),
      expect.objectContaining({ id: 'thunder', placement: 'combat' }),
    ])
    expect(removeSound(sounds, 'rain')).toHaveLength(1)
  })

  it('updates One-shot timing without allowing negative or inverted ranges', () => {
    const sounds = addCatalogItem([], thunder)

    expect(setSoundTiming(sounds, 'thunder', -2, 1)).toEqual([
      expect.objectContaining({
        minIntervalSeconds: 0,
        maxIntervalSeconds: 1,
      }),
    ])
    expect(setSoundTiming(sounds, 'thunder', 5, 2)).toEqual([
      expect.objectContaining({
        minIntervalSeconds: 5,
        maxIntervalSeconds: 5,
      }),
    ])
  })

  it('adds only missing pack members to Combat, preserving presets and existing settings, then removes every member', () => {
    const existing = addCatalogItem([], { ...music, volume: 0.2 })
    const pack = {
      id: 'storm-pack',
      name: 'Storm',
      kind: 'pack' as const,
      items: [
        { ...music, volume: 0.8 },
        {
          ...thunder,
          volume: 0.4,
          minIntervalSeconds: 3,
          maxIntervalSeconds: 9,
        },
      ],
    }
    expect(isCatalogResultAdded(existing, pack)).toBe(false)
    const added = toggleCatalogResult(existing, pack, 'combat')
    expect(added).toEqual([
      expect.objectContaining({
        id: music.id,
        volume: 0.2,
        placement: 'ambiance',
      }),
      expect.objectContaining({
        id: thunder.id,
        volume: 0.4,
        placement: 'combat',
        minIntervalSeconds: 3,
        maxIntervalSeconds: 9,
      }),
    ])
    expect(isCatalogResultAdded(added, pack)).toBe(true)
    expect(toggleCatalogResult(added, pack)).toEqual([])
  })

  it('distinguishes ambient loops from music and excludes packs from sound filters', () => {
    const ambientLoop = { ...music, tags: ['weather'] }
    const pack = {
      id: 'pack',
      name: 'Rain',
      kind: 'pack' as const,
      items: [music],
    }
    expect(catalogMatches(ambientLoop, 'rain', 'ambiance')).toBe(true)
    expect(catalogMatches(ambientLoop, 'rain', 'music')).toBe(false)
    expect(catalogMatches(pack, 'rain', 'music')).toBe(false)
    expect(catalogMatches(pack, 'rain', 'everything')).toBe(true)
    expect(isCatalogResultAdded([], { ...pack, items: [] })).toBe(false)
  })
})
