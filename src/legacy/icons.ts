import { DEFAULT_ICON_OPTIONS, type IconCatalog } from '../domain/icons'

export const MAX_ICON_SEARCH_RESULT_COUNT = 20
const FONT_AWESOME_VERSION = '6.x'
const DEFAULT_ICON_API_URL = 'https://api.fontawesome.com'

type FontAwesomeStyle = {
  style?: unknown
}

type FontAwesomeFamilyStyles = {
  free?: FontAwesomeStyle[]
}

type FontAwesomeSearchResult = {
  id?: unknown
  familyStylesByLicense?: FontAwesomeFamilyStyles
}

type FontAwesomeGraphQLResponse = {
  data?: {
    search?: FontAwesomeSearchResult[]
  }
  errors?: Array<{ message?: unknown }>
}

function envValue(name: string): string | undefined {
  const value = import.meta.env[name] as string | undefined
  return value?.trim() || undefined
}

export function createLegacyIconCatalog(): IconCatalog {
  return {
    async search(query: string): Promise<string[]> {
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        return [...DEFAULT_ICON_OPTIONS]
      }

      const searchApiResultCount = MAX_ICON_SEARCH_RESULT_COUNT * 5
      const graphQLQuery = `query { search (version: "${FONT_AWESOME_VERSION}", query: ${JSON.stringify(trimmedQuery)}, first:${searchApiResultCount} ) { id familyStylesByLicense { free { style } } } }`

      const endpoint = envValue('VITE_ICON_API_URL') ?? DEFAULT_ICON_API_URL

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: graphQLQuery }),
      })

      if (!response.ok) {
        throw new Error(
          `Legacy icon catalog request failed (${response.status})`,
        )
      }

      const payload = (await response.json()) as FontAwesomeGraphQLResponse

      if (payload.errors && payload.errors.length > 0) {
        const message = payload.errors[0]?.message
        throw new Error(
          typeof message === 'string'
            ? `Icon catalog error: ${message}`
            : 'Icon catalog returned GraphQL errors',
        )
      }

      const searchItems = Array.isArray(payload.data?.search)
        ? payload.data!.search!
        : []

      const freeSolidIcons = searchItems.filter(
        (item) =>
          Array.isArray(item.familyStylesByLicense?.free) &&
          item.familyStylesByLicense!.free!.some(
            (styleObj) => styleObj.style === 'solid',
          ),
      )

      return freeSolidIcons
        .map((item) => (typeof item.id === 'string' ? item.id : ''))
        .filter(Boolean)
        .slice(0, MAX_ICON_SEARCH_RESULT_COUNT)
    },
  }
}
