import {
  catalogMatches,
  type CatalogItem,
  type SoundCatalog,
} from '../domain/catalog'
import { demoAudioSource } from '../audio/demo'

export const catalogItems: CatalogItem[] = [
  {
    id: 'rain',
    name: 'Rainfall',
    kind: 'loop',
    tags: ['weather', 'music'],
    source: { author: 'Turbobard Library', urls: [demoAudioSource(1)] },
  },
  {
    id: 'forest',
    name: 'Forest Ambiance',
    kind: 'loop',
    tags: ['nature', 'ambiance'],
    source: { author: 'Turbobard Library', urls: [demoAudioSource(2)] },
  },
  {
    id: 'thunder',
    name: 'Thunder Crack',
    kind: 'one-shot',
    tags: ['weather', 'ambiance'],
    variations: [demoAudioSource(3)],
    source: { author: 'Turbobard Library', urls: [demoAudioSource(3)] },
  },
]

export const demoSoundCatalog: SoundCatalog = {
  search: async (query, filter) =>
    catalogItems.filter((item) => catalogMatches(item, query, filter)),
}
