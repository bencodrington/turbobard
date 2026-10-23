import { describe, expect, it } from 'vitest'
import {
  addCatalogItem,
  addCatalogPack,
  catalogMatches,
  placeSound,
  removeSound,
} from './catalog'
import type { CatalogItem } from './catalog'

const music: CatalogItem = {
  id: 'rain',
  name: 'Rain Music',
  kind: 'loop',
  tags: ['weather'],
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
})
