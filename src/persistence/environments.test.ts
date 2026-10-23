import { describe, expect, it } from 'vitest'
import {
  createEnvironmentPersistence,
  VERSIONED_ENVIRONMENTS_KEY,
} from './environments'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('versioned Environment persistence', () => {
  it('migrates legacy groups into canonical Environments and preserves user data', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'groups',
      JSON.stringify([
        {
          index: 7,
          name: 'Ruined Keep',
          volume: 0.65,
          isExpanded: false,
          icon: 'castle',
          iconColour: '#E581FE',
          tracks: [
            {
              id: 'rain',
              index: 2,
              name: 'Rain',
              source: { author: 'A', urls: ['rain.mp3'] },
              tags: ['ambiance'],
              fileName: 'rain.mp3',
              volume: 0.4,
              isMuted: true,
              isPlaying: true,
              shouldLoad: true,
            },
            {
              id: 'owl',
              index: 3,
              samples: ['owl-a.mp3', 'owl-b.mp3'],
              volume: 0.8,
              minSecondsBetween: 4,
              maxSecondsBetween: 9,
              isMuted: false,
              isPlaying: true,
              shouldLoad: true,
            },
          ],
          combatTracks: [
            {
              id: 'battle',
              index: 4,
              name: 'Battle',
              fileName: 'battle.mp3',
              volume: 0.9,
              isMuted: false,
              isPlaying: true,
              shouldLoad: true,
            },
          ],
        },
      ]),
    )

    const persistence = createEnvironmentPersistence(storage)

    expect(persistence.load()).toEqual([
      {
        id: 'environment-7',
        name: 'Ruined Keep',
        volume: 0.65,
        expanded: false,
        icon: 'castle',
        iconColor: '#E581FE',
        playing: false,
        combatMode: false,
        sounds: [
          {
            id: 'rain',
            index: 2,
            kind: 'loop',
            placement: 'ambiance',
            name: 'Rain',
            source: { author: 'A', urls: ['rain.mp3'] },
            tags: ['ambiance'],
            fileName: 'rain.mp3',
            volume: 0.4,
            muted: true,
            loaded: false,
          },
          {
            id: 'owl',
            index: 3,
            kind: 'one-shot',
            placement: 'ambiance',
            volume: 0.8,
            variations: ['owl-a.mp3', 'owl-b.mp3'],
            minIntervalSeconds: 4,
            maxIntervalSeconds: 9,
            muted: false,
            loaded: false,
          },
          {
            id: 'battle',
            index: 4,
            kind: 'loop',
            placement: 'combat',
            name: 'Battle',
            fileName: 'battle.mp3',
            volume: 0.9,
            muted: false,
            loaded: false,
          },
        ],
      },
    ])
    expect(
      JSON.parse(storage.getItem(VERSIONED_ENVIRONMENTS_KEY)!),
    ).toMatchObject({
      version: 1,
      environments: [{ id: 'environment-7' }],
    })

    const migrated = createEnvironmentPersistence(storage).load()
    const secondStorage = new MemoryStorage()
    secondStorage.setItem('groups', storage.getItem('groups')!)
    expect(createEnvironmentPersistence(secondStorage).load()).toEqual(migrated)
    createEnvironmentPersistence(storage).save(migrated)
    storage.removeItem('groups')
    expect(createEnvironmentPersistence(storage).load()).toEqual(migrated)
  })

  it('normalizes missing legacy fields and uses the versioned format on round trip', () => {
    const storage = new MemoryStorage()
    storage.setItem('groups', JSON.stringify([{ index: 0, tracks: undefined }]))
    const persistence = createEnvironmentPersistence(storage)
    const restored = persistence.load()

    expect(restored[0]).toMatchObject({
      id: 'environment-0',
      name: 'Untitled environment',
      volume: 1,
      expanded: true,
      icon: null,
      iconColor: null,
      playing: false,
      combatMode: false,
      sounds: [],
    })

    persistence.save(restored)
    storage.removeItem('groups')
    expect(persistence.load()).toEqual(restored)
    expect(storage.getItem('groups')).toBeNull()
  })

  it('restores versioned Environments stopped and without runtime sound state', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      VERSIONED_ENVIRONMENTS_KEY,
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'forest',
            name: 'Forest',
            volume: 1,
            expanded: true,
            icon: null,
            iconColor: null,
            playing: true,
            combatMode: true,
            sounds: [
              {
                id: 'rain',
                kind: 'loop',
                placement: 'ambiance',
                volume: 1,
                loaded: true,
                isPlaying: true,
              },
            ],
          },
        ],
      }),
    )

    expect(createEnvironmentPersistence(storage).load()).toEqual([
      {
        id: 'forest',
        name: 'Forest',
        volume: 1,
        expanded: true,
        icon: null,
        iconColor: null,
        playing: false,
        combatMode: false,
        sounds: [
          {
            id: 'rain',
            kind: 'loop',
            placement: 'ambiance',
            volume: 1,
            loaded: false,
          },
        ],
      },
    ])
  })
})
