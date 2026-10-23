import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLegacyIconCatalog } from './icons'
import { DEFAULT_ICON_OPTIONS } from '../domain/icons'

describe('createLegacyIconCatalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns default icons when query is blank without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const catalog = createLegacyIconCatalog()

    const results = await catalog.search('   ')

    expect(results).toEqual(DEFAULT_ICON_OPTIONS)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('searches FontAwesome GraphQL API, filters to solid style icons, and limits results to 20', async () => {
    const mockGraphQLResponse = {
      data: {
        search: [
          {
            id: 'fire',
            familyStylesByLicense: {
              free: [{ style: 'solid' }],
            },
          },
          {
            id: 'fire-alt',
            familyStylesByLicense: {
              free: [{ style: 'regular' }],
            },
          },
          {
            id: 'fire-flame-curved',
            familyStylesByLicense: {
              free: [{ style: 'solid' }],
            },
          },
        ],
      },
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockGraphQLResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const catalog = createLegacyIconCatalog()
    const results = await catalog.search('fire')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, requestInit] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.fontawesome.com')
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.body).toContain('fire')
    expect(results).toEqual(['fire', 'fire-flame-curved'])
  })

  it('throws an error when FontAwesome returns GraphQL errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: 'Rate limit exceeded' }],
        }),
        { status: 200 },
      ),
    )

    const catalog = createLegacyIconCatalog()
    await expect(catalog.search('sword')).rejects.toThrow(
      /rate limit exceeded|icon catalog error/i,
    )
  })

  it('throws an error when HTTP request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Service unavailable', { status: 503 }),
    )

    const catalog = createLegacyIconCatalog()
    await expect(catalog.search('sword')).rejects.toThrow(
      /failed \(503\)|unavailable/i,
    )
  })
})
