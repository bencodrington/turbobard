import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLegacySoundCatalog } from './catalog'

describe('legacy sound catalog', () => {
  afterEach(() => vi.restoreAllMocks())

  it('searches the legacy API and resolves loop metadata into playable storage URLs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'loop-1', name: 'Cave', tags: ['dark'], type: 'LOOP' },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'loop-1',
            name: 'Cave',
            fileName: 'cave-ambience',
            tags: ['dark'],
            source: { author: 'Legacy artist', urls: ['credit-url'] },
            type: 'LOOP',
          }),
        ),
      )

    await expect(
      createLegacySoundCatalog().search('cave', 'everything'),
    ).resolves.toEqual([
      {
        id: 'loop-1',
        name: 'Cave',
        kind: 'loop',
        tags: ['dark'],
        source: {
          author: 'Legacy artist',
          urls: [
            'https://storage.googleapis.com/turbo-bard.appspot.com/cave-ambience.mp3',
          ],
        },
      },
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toContain('searchText=cave')
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      'searchResultType=EVERYTHING',
    )
    expect(fetchMock.mock.calls[1]?.[0]).toContain('trackId=loop-1')
  })

  it('maps one-shot samples and timing metadata', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'shot-1', name: 'Horn', tags: ['battle'], type: 'ONESHOT' },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'shot-1',
            name: 'Horn',
            samples: ['horn-a', 'horn-b'],
            minSecondsBetween: 3,
            maxSecondsBetween: 9,
            tags: ['battle'],
            source: { author: 'Legacy artist' },
            type: 'ONESHOT',
          }),
        ),
      )

    await expect(
      createLegacySoundCatalog().search('horn', 'ambiance'),
    ).resolves.toMatchObject([
      {
        id: 'shot-1',
        kind: 'one-shot',
        variations: [
          'https://storage.googleapis.com/turbo-bard.appspot.com/horn-a.mp3',
          'https://storage.googleapis.com/turbo-bard.appspot.com/horn-b.mp3',
        ],
        minIntervalSeconds: 3,
        maxIntervalSeconds: 9,
      },
    ])
  })

  it('does not call the API for an empty query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    await expect(
      createLegacySoundCatalog().search('  ', 'everything'),
    ).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns ordered pack results with member presets and reuses overlapping metadata requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => {
        const parsed = new URL(String(url))
        if (parsed.pathname.endsWith('/search_v3'))
          return new Response(
            JSON.stringify([
              {
                id: 'pack',
                name: 'Swamp Travel',
                type: 'PACK',
                tags: ['pack', 'swamp'],
                tracks: [
                  { id: 'music', volume: 0.3 },
                  {
                    id: 'frogs',
                    volume: 0.6,
                    oneShotConfig: {
                      minSecondsBetween: 5,
                      maxSecondsBetween: 12,
                    },
                  },
                ],
              },
              { id: 'music', name: 'Swamp Music', type: 'LOOP' },
            ]),
          )
        const id = parsed.searchParams.get('trackId')
        return new Response(
          JSON.stringify(
            id === 'music'
              ? {
                  id,
                  name: 'Swamp Music',
                  type: 'LOOP',
                  tags: ['music'],
                  fileName: 'swamp-music',
                }
              : {
                  id,
                  name: 'Frogs',
                  type: 'ONESHOT',
                  tags: ['swamp'],
                  samples: ['frog'],
                  minSecondsBetween: 1,
                  maxSecondsBetween: 2,
                },
          ),
        )
      })
    const catalog = createLegacySoundCatalog()
    const results = await catalog.search('swamp', 'everything')
    expect(results).toMatchObject([
      {
        id: 'pack',
        kind: 'pack',
        tags: ['pack', 'swamp'],
        items: [
          { id: 'music', volume: 0.3, tags: ['music'] },
          {
            id: 'frogs',
            volume: 0.6,
            minIntervalSeconds: 5,
            maxIntervalSeconds: 12,
          },
        ],
      },
      { id: 'music', kind: 'loop' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(await catalog.search('swamp', 'music')).toMatchObject([
      { id: 'music', kind: 'loop' },
    ])
    expect(await catalog.search('swamp', 'ambiance')).not.toContainEqual(
      expect.objectContaining({ kind: 'pack' }),
    )
  })
})
