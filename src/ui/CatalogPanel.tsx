import { useCallback, useEffect, useRef, useState } from 'react'
import './CatalogPanel.css'
import type { Environment } from '../domain/playback'
import {
  isCatalogMusic,
  isCatalogResultAdded,
  toggleCatalogResult,
  type CatalogFilter,
  type CatalogItem,
  type CatalogResult,
} from '../domain/catalog'
import { AsyncSearchState } from './AsyncSearchState'
import { Button } from './Button'
import { CombatToggle } from './CombatToggle'
import { FontAwesomeIconView } from './icons'
import { selectAllTextOnFocus } from './selectAllTextOnFocus'

const filters = [
  { value: 'everything', label: 'Everything', icon: 'magnifying-glass' },
  { value: 'music', label: 'Music', icon: 'music' },
  { value: 'ambiance', label: 'Ambiance', icon: 'cloud-sun-rain' },
] as const

export function CatalogPanel({
  environment,
  open,
  onClose,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  results,
  loading,
  error,
  onRetry,
  onSoundsChange,
}: {
  environment?: Environment
  open: boolean
  onClose: () => void
  query: string
  onQueryChange: (query: string) => void
  filter: CatalogFilter
  onFilterChange: (filter: CatalogFilter) => void
  results: CatalogResult[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onSoundsChange: (sounds: Environment['sounds']) => void
}) {
  const [addToCombat, setAddToCombat] = useState(false)
  const [previewId, setPreviewId] = useState<string>()
  const [previewError, setPreviewError] = useState<string>()
  const preview = useRef<HTMLAudioElement | undefined>(undefined)

  const stopPreview = useCallback(() => {
    const audio = preview.current
    preview.current = undefined
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [])

  useEffect(() => {
    setAddToCombat(false)
  }, [open, environment?.id])

  useEffect(() => {
    setPreviewId(undefined)
    setPreviewError(undefined)
    return stopPreview
  }, [open, environment?.id, query, filter, stopPreview])

  const togglePreview = (item: CatalogItem) => {
    const wasPlaying = previewId === item.id
    stopPreview()
    setPreviewId(undefined)
    setPreviewError(undefined)
    if (wasPlaying) return
    const source =
      item.kind === 'one-shot'
        ? (item.variations?.[0] ?? item.source?.urls[0])
        : item.source?.urls[0]
    if (!source) {
      setPreviewError(`Preview unavailable: ${item.name}`)
      return
    }
    const audio = new Audio(source)
    preview.current = audio
    setPreviewId(item.id)
    const finish = (failed = false) => {
      if (preview.current !== audio) return
      stopPreview()
      setPreviewId(undefined)
      if (failed) setPreviewError(`Preview unavailable: ${item.name}`)
    }
    audio.addEventListener('ended', () => finish())
    audio.addEventListener('error', () => finish(true))
    void audio.play().catch(() => finish(true))
  }

  return (
    <section
      className={`catalog-panel${open ? ' mobile-search-open' : ''}`}
      aria-label="Search"
    >
      <div className="catalog-header">
        <Button
          variant="ghost"
          iconOnly
          className="mobile-search-close"
          aria-label="Close search"
          onClick={onClose}
        >
          <FontAwesomeIconView iconId="arrow-left" />
        </Button>
        <h2 id="catalog-heading">
          {environment ? `Add sounds to ${environment.name}` : 'Search'}
        </h2>
        <CombatToggle
          label="Add to combat"
          checked={addToCombat}
          disabled={!environment}
          onChange={setAddToCombat}
        />
      </div>
      <div className="catalog-search-field">
        <FontAwesomeIconView iconId="magnifying-glass" />
        <input
          id="catalog-search"
          aria-label="Search Sounds"
          value={query}
          onFocus={selectAllTextOnFocus}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search"
        />
      </div>
      <div
        className="catalog-filters"
        role="group"
        aria-label="Catalog filters"
      >
        {filters.map(({ value, label, icon }) => (
          <Button
            key={value}
            variant="ghost"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            <FontAwesomeIconView iconId={icon} /> {label}
          </Button>
        ))}
      </div>
      {previewError && (
        <p role="alert" className="catalog-preview-error">
          {previewError}
        </p>
      )}
      <AsyncSearchState
        loading={loading}
        error={error}
        empty={results.length === 0}
        loadingMessage="Loading Sounds…"
        errorMessage="Legacy sound catalog unavailable. Check your local API configuration and network access."
        emptyMessage={
          <p className="empty-state">
            {query.trim() ? 'No Sounds found.' : 'Search for sounds and packs.'}
          </p>
        }
        onRetry={onRetry}
      >
        <div className="catalog-results">
          {results.map((result) => {
            const isPack = result.kind === 'pack'
            const added = isCatalogResultAdded(
              environment?.sounds ?? [],
              result,
            )
            const music = !isPack && isCatalogMusic(result)
            return (
              <article
                className={`catalog-item${isPack ? ' catalog-pack' : ''}`}
                key={`${result.kind}:${result.id}`}
              >
                <span
                  className="catalog-result-icon"
                  role="img"
                  aria-label={isPack ? 'Pack' : music ? 'Music' : 'Ambiance'}
                >
                  <FontAwesomeIconView
                    iconId={
                      isPack ? 'folder' : music ? 'music' : 'cloud-sun-rain'
                    }
                  />
                </span>
                <div className="catalog-item-info">
                  <strong>{result.name}</strong>
                  {isPack && (
                    <p>
                      Contains {result.items.length} sound
                      {result.items.length === 1 ? '' : 's'}
                      {result.items.some(isCatalogMusic)
                        ? ', including music.'
                        : '.'}
                    </p>
                  )}
                  <ul
                    className="catalog-tags"
                    aria-label={`Tags for ${result.name}`}
                  >
                    {(result.tags ?? [])
                      .filter((tag) => tag !== 'pack')
                      .map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                  </ul>
                </div>
                {!isPack && (
                  <Button
                    variant="ghost"
                    iconOnly
                    className="catalog-preview"
                    aria-label={`${previewId === result.id ? 'Stop preview of' : 'Preview'} ${result.name}`}
                    onClick={() => togglePreview(result)}
                  >
                    <FontAwesomeIconView
                      iconId={
                        previewId === result.id ? 'circle-stop' : 'circle-play'
                      }
                    />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  iconOnly
                  className="catalog-add"
                  aria-label={`${added ? 'Remove' : 'Add'} ${result.name}${added ? ' from' : ' to'} environment`}
                  disabled={
                    !environment || (isPack && result.items.length === 0)
                  }
                  onClick={() =>
                    environment &&
                    onSoundsChange(
                      toggleCatalogResult(
                        environment.sounds,
                        result,
                        addToCombat ? 'combat' : 'ambiance',
                      ),
                    )
                  }
                >
                  <FontAwesomeIconView iconId={added ? 'minus' : 'plus'} />
                </Button>
              </article>
            )
          })}
        </div>
      </AsyncSearchState>
    </section>
  )
}
