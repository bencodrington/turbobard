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
            { id: 'pack-1', name: 'Pack', tags: [], type: 'PACK' },
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
})
