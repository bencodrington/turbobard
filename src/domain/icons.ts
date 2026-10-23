export type IconCatalog = {
  search: (query: string) => Promise<string[]>
}

export const DEFAULT_ENVIRONMENT_ICON = 'mountain-sun'
export const DEFAULT_ENVIRONMENT_ICON_COLOR = '#A7A7A7'

export const DEFAULT_ICON_OPTIONS: readonly string[] = [
  'mountain-sun',
  'burst',
  'bell',
  'snowflake',
  'fire',
  'guitar',
  'leaf',
  'fish',
  'wand-sparkles',
  'poo',
  'skull',
  'hat-wizard',
  'cloud-bolt',
  'chess-rook',
  'heart',
  'hill-rockslide',
  'drum',
  'hands-clapping',
  'campground',
  'sack-dollar',
]

export const ICON_COLOR_OPTIONS: readonly string[] = [
  DEFAULT_ENVIRONMENT_ICON_COLOR,
  '#73B2FD',
  '#E581FE',
  '#F87C7C',
  '#DCC343',
  '#9CC870',
]
