import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Environment } from './domain/playback'
import { createEnvironmentPersistence } from './persistence/environments'
import {
  addCatalogItem,
  addCatalogPack,
  placeSound,
  removeSound,
  type CatalogFilter,
  type CatalogItem,
  type SoundCatalog,
} from './domain/catalog'
import {
  DEFAULT_ENVIRONMENT_ICON,
  DEFAULT_ENVIRONMENT_ICON_COLOR,
  DEFAULT_ICON_OPTIONS,
  ICON_COLOR_OPTIONS,
  type IconCatalog,
} from './domain/icons'
import { createPlaybackCoordinator } from './domain/coordinator'
import { createBrowserAudioPort } from './audio/browser'
import { createLegacySoundCatalog } from './legacy/catalog'
import { createLegacyIconCatalog } from './legacy/icons'
import type { EnvironmentPersistence } from './domain/ports'
import { FontAwesomeIconView } from './ui/icons'
import { AsyncSearchState } from './ui/AsyncSearchState'
import { LabeledNumberField, LabeledRangeField } from './ui/LabeledFields'
import { ModalShell } from './ui/ModalShell'
import { createEnvironmentWorkspace } from './workspace/environmentWorkspace'

function newEnvironmentId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `environment-${Date.now()}`
}

function EnvironmentIcon({ iconId }: { iconId: string }) {
  return <FontAwesomeIconView iconId={iconId} className="environment-icon" />
}

export type AppProps = {
  soundCatalog?: SoundCatalog
  iconCatalog?: IconCatalog
  persistence?: EnvironmentPersistence
}

export default function App({
  soundCatalog,
  iconCatalog,
  persistence: persistenceProp,
}: AppProps = {}) {
  const persistence = useMemo(
    () => persistenceProp ?? createEnvironmentPersistence(window.localStorage),
    [persistenceProp],
  )
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [isEditMode, setIsEditMode] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CatalogFilter>('everything')
  const [catalogError, setCatalogError] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [results, setResults] = useState<CatalogItem[]>([])
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [audioError, setAudioError] = useState<string | undefined>()
  const catalog = useMemo(
    () => soundCatalog ?? createLegacySoundCatalog(),
    [soundCatalog],
  )
  const icons = useMemo(
    () => iconCatalog ?? createLegacyIconCatalog(),
    [iconCatalog],
  )
  const [editingIconEnvId, setEditingIconEnvId] = useState<string | null>(null)
  const [iconQuery, setIconQuery] = useState('')
  const [iconResults, setIconResults] = useState<string[]>(() => [
    ...DEFAULT_ICON_OPTIONS,
  ])
  const [iconLoading, setIconLoading] = useState(false)
  const [iconError, setIconError] = useState(false)
  const [iconAttempt, setIconAttempt] = useState(0)
  const playback = useMemo(
    () =>
      createPlaybackCoordinator({
        audio: createBrowserAudioPort(),
        clock: {
          now: () => performance.now(),
          setTimeout: (callback, delayMs) =>
            window.setTimeout(callback, delayMs),
          clearTimeout: (handle) => window.clearTimeout(handle as number),
        },
        random: { next: () => Math.random() },
        onSoundError: (soundId) =>
          setAudioError(`Sound unavailable: ${soundId}`),
      }),
    [],
  )
  const workspace = useMemo(
    () =>
      createEnvironmentWorkspace({
        persistence,
        playback,
        createId: newEnvironmentId,
      }),
    [persistence, playback],
  )
  const { environments } = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  )
  const [isEditorOpen, setIsEditorOpen] = useState(
    () =>
      workspace.getSnapshot().environments.length > 0 &&
      (window.matchMedia?.('(min-width: 900px)').matches ?? true),
  )
  const selectedEnvironment = environments.find(
    (item) => item.id === selectedId,
  )
  const editingEnvironment = environments.find(
    (item) => item.id === editingIconEnvId,
  )
  const displayedIcons = useMemo(() => {
    if (
      editingEnvironment?.icon &&
      !iconResults.includes(editingEnvironment.icon)
    ) {
      return [editingEnvironment.icon, ...iconResults]
    }
    return iconResults
  }, [editingEnvironment?.icon, iconResults])
  const [, setPlaybackRevision] = useState(0)
  useEffect(() => {
    setSelectedId((current) => current ?? environments[0]?.id)
  }, [environments])
  useEffect(() => {
    let frame: number | undefined
    let running = false
    const refresh = () => {
      running = false
      setPlaybackRevision((revision) => revision + 1)
      if (playback.scheduledOneShotCount() > 0) requestRefresh()
    }
    const requestRefresh = () => {
      if (running) return
      running = true
      frame = window.requestAnimationFrame(refresh)
    }
    const unsubscribe = playback.subscribe(requestRefresh)
    requestRefresh()
    return () => {
      unsubscribe()
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [playback])
  useEffect(() => () => playback.dispose(), [playback])
  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    setCatalogError(false)
    catalog
      .search(query, filter)
      .then((next) => active && setResults(next))
      .catch(() => active && setCatalogError(true))
      .finally(() => active && setCatalogLoading(false))
    return () => {
      active = false
    }
  }, [catalog, catalogAttempt, filter, query])

  useEffect(() => {
    if (!editingIconEnvId) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setEditingIconEnvId(null)
      }
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [editingIconEnvId])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isAboutOpen) setIsAboutOpen(false)
      else if (isEditorOpen) setIsEditorOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isAboutOpen, isEditorOpen])

  useEffect(() => {
    if (!editingIconEnvId) return
    let active = true
    setIconLoading(true)
    setIconError(false)
    icons
      .search(iconQuery)
      .then((next) => {
        if (active) setIconResults(next)
      })
      .catch(() => {
        if (active) setIconError(true)
      })
      .finally(() => {
        if (active) setIconLoading(false)
      })
    return () => {
      active = false
    }
  }, [editingIconEnvId, iconAttempt, iconQuery, icons])

  const updateEnvironmentIcon = (environment: Environment, icon: string) => {
    workspace.setIcon(environment.id, icon)
  }

  const updateEnvironmentIconColor = (
    environment: Environment,
    iconColor: string,
  ) => {
    workspace.setIconColor(environment.id, iconColor)
  }

  const addEnvironment = () => {
    const environment = workspace.addEnvironment()
    setSelectedId(environment.id)
    setIsEditorOpen(true)
  }

  const openEnvironment = (environment: Environment) => {
    setSelectedId(environment.id)
    const isDesktop = window.matchMedia?.('(min-width: 900px)').matches ?? true
    if (isEditMode) {
      setIsEditorOpen(true)
      setIsSearchOpen(false)
      return
    }
    if (environment.playing) workspace.stop(environment.id)
    else workspace.play(environment.id)
    if (isDesktop) {
      setIsEditorOpen(true)
      setIsSearchOpen(false)
    }
  }

  const renameEnvironmentInState = (environment: Environment, name: string) => {
    workspace.renameEnvironment(environment.id, name)
  }

  const removeEnvironment = (environmentId: string) => {
    const next = environments.filter((item) => item.id !== environmentId)
    workspace.removeEnvironment(environmentId)
    if (selectedId === environmentId) {
      setSelectedId(next[0]?.id)
      setIsEditorOpen(false)
      setIsSearchOpen(false)
    }
  }

  const toggleExpanded = (environment: Environment) => {
    workspace.toggleExpanded(environment.id)
  }

  const updateSelectedSounds = (sounds: Environment['sounds']) => {
    if (!selectedEnvironment) return
    workspace.updateSounds(selectedEnvironment.id, sounds)
  }

  const playEnvironment = (environment: Environment) => {
    workspace.play(environment.id)
  }

  const stopEnvironment = (environment: Environment) => {
    workspace.stop(environment.id)
  }

  const toggleCombat = (environment: Environment) => {
    workspace.toggleCombat(environment.id)
  }

  const updateEnvironmentVolume = (
    environment: Environment,
    volume: number,
  ) => {
    workspace.setEnvironmentVolume(environment.id, volume)
  }

  const updateSoundVolume = (
    environment: Environment,
    sound: Environment['sounds'][number],
    volume: number,
  ) => {
    workspace.setSoundVolume(environment.id, sound.id, volume)
  }

  const updateSoundTiming = (
    environment: Environment,
    sound: Environment['sounds'][number],
    field: 'minIntervalSeconds' | 'maxIntervalSeconds',
    value: number,
  ) => {
    const minimum = sound.minIntervalSeconds ?? 0
    const maximum = sound.maxIntervalSeconds ?? minimum
    const nextMinimum = field === 'minIntervalSeconds' ? value : minimum
    const nextMaximum = field === 'maxIntervalSeconds' ? value : maximum
    workspace.setSoundTiming(environment.id, sound.id, nextMinimum, nextMaximum)
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <header className="app-header">
          <div>
            <h1 id="app-title">Turbobard</h1>
          </div>
          <button
            className="secondary-button header-button"
            aria-label="About"
            onClick={() => setIsAboutOpen(true)}
          >
            <FontAwesomeIconView iconId="circle-info" />
            <span>About</span>
          </button>
        </header>
        {audioError && (
          <div role="alert" className="audio-error">
            {audioError}{' '}
            <button
              className="text-button"
              onClick={() => setAudioError(undefined)}
            >
              Dismiss
            </button>
          </div>
        )}
        <div className={`workspace-body${isSearchOpen ? ' search-open' : ''}`}>
          <section
            aria-labelledby="environments-heading"
            className="environment-panel"
          >
            <div className="section-heading">
              <h2 id="environments-heading">Environments</h2>
              <button
                className={`icon-only-button${isEditMode ? ' active' : ''}`}
                aria-label="Edit environments"
                aria-pressed={isEditMode}
                onClick={() => setIsEditMode((value) => !value)}
              >
                <FontAwesomeIconView iconId="pencil" />
              </button>
              <button className="primary-button" onClick={addEnvironment}>
                Create Environment
              </button>
            </div>
            {environments.length === 0 ? (
              <p className="empty-state">
                No Environments yet. Create one to start building a scene.
              </p>
            ) : (
              <div className="environment-list" role="list">
                {environments.map((environment) => {
                  const selected = selectedId === environment.id && isEditorOpen
                  return (
                    <button
                      className={`environment-tile${selected ? ' selected' : ''}${environment.playing ? ' playing' : ''}`}
                      key={environment.id}
                      aria-label={`${isEditMode ? 'Open' : environment.playing ? 'Stop' : 'Play'} ${environment.name}`}
                      onClick={() => openEnvironment(environment)}
                    >
                      <span
                        className="environment-tile-icon"
                        style={{
                          color:
                            environment.iconColor ??
                            DEFAULT_ENVIRONMENT_ICON_COLOR,
                        }}
                      >
                        <EnvironmentIcon
                          iconId={environment.icon ?? DEFAULT_ENVIRONMENT_ICON}
                        />
                      </span>
                      <span>{environment.name}</span>
                      {environment.playing && (
                        <span className="tile-playing" aria-label="Playing">
                          <FontAwesomeIconView iconId="volume-high" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {selectedEnvironment && isEditorOpen && (
            <section
              className="environment-editor"
              aria-labelledby="editor-heading"
            >
              <h2 id="editor-heading" className="sr-only">
                {selectedEnvironment.name}
              </h2>
              <button
                className="secondary-button mobile-search-button"
                onClick={() => setIsSearchOpen(true)}
              >
                <FontAwesomeIconView iconId="magnifying-glass" /> Search Sounds
              </button>
              <div className="environment-card selected">
                <div className="environment-card-header">
                  <button
                    className="text-button editor-back-button"
                    aria-label="Close Environment"
                    onClick={() => setIsEditorOpen(false)}
                  >
                    <FontAwesomeIconView iconId="arrow-left" /> Back
                  </button>
                  <button
                    className="icon-trigger-button"
                    aria-label={`Select icon for ${selectedEnvironment.name}`}
                    data-icon={
                      selectedEnvironment.icon ?? DEFAULT_ENVIRONMENT_ICON
                    }
                    data-color={
                      selectedEnvironment.iconColor ??
                      DEFAULT_ENVIRONMENT_ICON_COLOR
                    }
                    onClick={() => {
                      setEditingIconEnvId(selectedEnvironment.id)
                      setIconQuery('')
                      setIconError(false)
                    }}
                    style={{
                      color:
                        selectedEnvironment.iconColor ??
                        DEFAULT_ENVIRONMENT_ICON_COLOR,
                    }}
                  >
                    <EnvironmentIcon
                      iconId={
                        selectedEnvironment.icon ?? DEFAULT_ENVIRONMENT_ICON
                      }
                    />
                  </button>
                  <label
                    className="sr-only"
                    htmlFor={`name-${selectedEnvironment.id}`}
                  >
                    Environment name
                  </label>
                  <input
                    id={`name-${selectedEnvironment.id}`}
                    value={selectedEnvironment.name}
                    onChange={(event) =>
                      renameEnvironmentInState(
                        selectedEnvironment,
                        event.target.value,
                      )
                    }
                  />
                  <button
                    className="primary-button"
                    onClick={() =>
                      selectedEnvironment.playing
                        ? stopEnvironment(selectedEnvironment)
                        : playEnvironment(selectedEnvironment)
                    }
                  >
                    {selectedEnvironment.playing ? 'Stop' : 'Play'}
                  </button>
                  {selectedEnvironment.playing && (
                    <button
                      className="secondary-button"
                      aria-pressed={selectedEnvironment.combatMode}
                      onClick={() => toggleCombat(selectedEnvironment)}
                    >
                      {selectedEnvironment.combatMode
                        ? 'Combat on'
                        : 'Combat off'}
                    </button>
                  )}
                </div>
                <div className="environment-actions">
                  <button
                    aria-expanded={selectedEnvironment.expanded}
                    className="text-button"
                    onClick={() => toggleExpanded(selectedEnvironment)}
                  >
                    {selectedEnvironment.expanded ? 'Collapse' : 'Expand'}
                  </button>
                  <button
                    className="text-button danger-button"
                    onClick={() => removeEnvironment(selectedEnvironment.id)}
                  >
                    Delete
                  </button>
                </div>
                {selectedEnvironment.expanded && (
                  <div className="environment-details">
                    <LabeledRangeField
                      label="Environment volume"
                      value={selectedEnvironment.volume}
                      inputProps={{
                        'aria-label': `Volume for ${selectedEnvironment.name}`,
                        min: 0,
                        max: 1,
                        step: 0.01,
                      }}
                      onChange={(event) =>
                        updateEnvironmentVolume(
                          selectedEnvironment,
                          Number(event.target.value),
                        )
                      }
                    />
                  </div>
                )}
              </div>
              <div className="sound-list">
                <h3>Sounds in Environment</h3>
                {selectedEnvironment.sounds.length === 0 ? (
                  <p className="empty-state">No Sounds added yet.</p>
                ) : (
                  selectedEnvironment.sounds.map((sound) => (
                    <div className="sound-row" key={sound.id}>
                      <span className="sound-name">
                        {sound.name ?? sound.id}
                        {selectedEnvironment.playing &&
                          sound.kind === 'one-shot' &&
                          (() => {
                            const state = playback.oneShotState(sound.id)
                            if (!state) return null
                            const seconds = state.remainingMs / 1_000
                            const remainingLabel =
                              seconds < 1
                                ? '<1 second'
                                : `${Math.ceil(seconds)} seconds`
                            return (
                              <span
                                className="one-shot-wick"
                                role="img"
                                aria-label={`${sound.name ?? sound.id}: next sound in ${remainingLabel}`}
                                title={`Next sound in ${remainingLabel}`}
                                style={{
                                  background: `conic-gradient(var(--accent) ${state.fractionRemaining * 360}deg, var(--border-strong) 0deg)`,
                                }}
                              />
                            )
                          })()}
                      </span>
                      <LabeledRangeField
                        label={null}
                        value={sound.volume}
                        inputProps={{
                          'aria-label': `Volume for ${sound.name ?? sound.id}`,
                          min: 0,
                          max: 1,
                          step: 0.01,
                        }}
                        onChange={(event) =>
                          updateSoundVolume(
                            selectedEnvironment,
                            sound,
                            Number(event.target.value),
                          )
                        }
                      />
                      <select
                        aria-label={`Placement for ${sound.name ?? sound.id}`}
                        value={sound.placement}
                        onChange={(event) =>
                          updateSelectedSounds(
                            placeSound(
                              selectedEnvironment.sounds,
                              sound.id,
                              event.target.value as 'ambiance' | 'combat',
                            ),
                          )
                        }
                      >
                        <option value="ambiance">Ambiance</option>
                        <option value="combat">Combat</option>
                      </select>
                      <button
                        className="text-button danger-button"
                        onClick={() =>
                          updateSelectedSounds(
                            removeSound(selectedEnvironment.sounds, sound.id),
                          )
                        }
                      >
                        Remove
                      </button>
                      {sound.kind === 'one-shot' && (
                        <>
                          <LabeledNumberField
                            label="Minimum interval (seconds)"
                            value={sound.minIntervalSeconds ?? 0}
                            inputProps={{
                              'aria-label': `Minimum interval for ${sound.name ?? sound.id}`,
                              min: 0,
                              step: 1,
                            }}
                            onChange={(event) =>
                              updateSoundTiming(
                                selectedEnvironment,
                                sound,
                                'minIntervalSeconds',
                                Number(event.target.value),
                              )
                            }
                          />
                          <LabeledNumberField
                            label="Maximum interval (seconds)"
                            value={
                              sound.maxIntervalSeconds ??
                              sound.minIntervalSeconds ??
                              0
                            }
                            inputProps={{
                              'aria-label': `Maximum interval for ${sound.name ?? sound.id}`,
                              min: 0,
                              step: 1,
                            }}
                            onChange={(event) =>
                              updateSoundTiming(
                                selectedEnvironment,
                                sound,
                                'maxIntervalSeconds',
                                Number(event.target.value),
                              )
                            }
                          />
                          <button
                            className="text-button"
                            onClick={() =>
                              workspace.playManualOneShot(
                                selectedEnvironment.id,
                                sound.id,
                              )
                            }
                          >
                            Play now
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          <section
            className={`catalog-panel${isSearchOpen ? ' mobile-search-open' : ''}`}
            aria-labelledby="catalog-heading"
          >
            <div className="section-heading">
              <button
                className="text-button mobile-search-close"
                aria-label="Close search"
                onClick={() => setIsSearchOpen(false)}
              >
                <FontAwesomeIconView iconId="arrow-left" /> Back
              </button>
              <h2 id="catalog-heading">Search</h2>
            </div>
            <label className="sr-only" htmlFor="catalog-search">
              Search
            </label>
            <input
              id="catalog-search"
              aria-label="Search Sounds"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
            <div
              className="catalog-filters"
              role="group"
              aria-label="Catalog filters"
            >
              {(['everything', 'music', 'ambiance'] as CatalogFilter[]).map(
                (value) => (
                  <button
                    key={value}
                    className={`secondary-button${filter === value ? ' active' : ''}`}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </button>
                ),
              )}
            </div>
            <AsyncSearchState
              loading={catalogLoading}
              error={catalogError}
              empty={results.length === 0}
              loadingMessage="Loading Sounds…"
              errorMessage={
                <>
                  Legacy sound catalog unavailable. Check your local API
                  configuration and network access.
                </>
              }
              emptyMessage={<p className="empty-state">No Sounds found.</p>}
              onRetry={() => setCatalogAttempt((attempt) => attempt + 1)}
            >
              <div className="catalog-results">
                {results.map((item) => (
                  <article className="catalog-item" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.kind === 'loop' ? 'Music' : 'Ambiance'} ·{' '}
                        {item.source?.author ?? 'Unknown source'}
                      </small>
                    </div>
                    <button
                      className="secondary-button"
                      disabled={!selectedEnvironment}
                      onClick={() =>
                        updateSelectedSounds(
                          addCatalogItem(
                            selectedEnvironment?.sounds ?? [],
                            item,
                          ),
                        )
                      }
                    >
                      Add
                    </button>
                    <details>
                      <summary>Source details</summary>
                      <p>{item.source?.author ?? 'Unknown source'}</p>
                    </details>
                  </article>
                ))}
              </div>
            </AsyncSearchState>
            {selectedEnvironment && results.length > 1 && (
              <button
                className="primary-button"
                onClick={() =>
                  updateSelectedSounds(
                    addCatalogPack(selectedEnvironment.sounds, results),
                  )
                }
              >
                Add results as pack
              </button>
            )}
          </section>
        </div>
      </section>
      {isAboutOpen && (
        <ModalShell
          title="About"
          titleId="about-title"
          className="about-card"
          closeLabel="Close About"
          onClose={() => setIsAboutOpen(false)}
        >
          <div className="about-body">
            <section>
              <h3>TurboBard is a passion project.</h3>
              <p>
                If you'd like, you can donate to help cover the costs of running
                it.
              </p>
              <a href="https://ko-fi.com/projectbench">Support me</a>
            </section>
            <section>
              <h3>Data policy.</h3>
              <p>No personal data is recorded at any time.</p>
            </section>
            <section>
              <h3>About the audio.</h3>
              <p>
                I've collected sounds with permissive licenses, and linked the
                source wherever possible.
              </p>
            </section>
            <section>
              <h3>Contact me.</h3>
              <p>
                Please send any feedback, bugs, or ideas to{' '}
                <a href="mailto:phanarydev@gmail.com">phanarydev@gmail.com</a>
              </p>
            </section>
          </div>
        </ModalShell>
      )}
      {editingEnvironment && (
        <ModalShell
          title="Select an icon"
          titleId="icon-modal-title"
          subtitle={editingEnvironment.name}
          closeLabel="Close icon picker"
          onClose={() => setEditingIconEnvId(null)}
        >
          <label htmlFor="icon-search">Search icons</label>
          <input
            id="icon-search"
            value={iconQuery}
            onChange={(event) => setIconQuery(event.target.value)}
            placeholder="Search for icons"
          />
          <AsyncSearchState
            loading={iconLoading}
            error={iconError}
            empty={displayedIcons.length === 0}
            loadingMessage="Loading icons…"
            errorMessage={
              <>
                Icon catalog unavailable. Check your local API configuration and
                network access.
              </>
            }
            errorClassName="icon-error"
            emptyMessage={
              <p className="empty-state">
                {iconQuery.trim()
                  ? `No icons found for "${iconQuery}".`
                  : 'No icons found.'}
              </p>
            }
            onRetry={() => setIconAttempt((attempt) => attempt + 1)}
          >
            <div
              className="icon-grid"
              role="group"
              aria-label="Available icons"
            >
              {displayedIcons.map((iconId) => {
                const isSelected =
                  (editingEnvironment.icon ?? DEFAULT_ENVIRONMENT_ICON) ===
                  iconId
                return (
                  <button
                    key={iconId}
                    className={`icon-option-button${isSelected ? ' selected' : ''}`}
                    aria-label={iconId}
                    aria-pressed={isSelected}
                    onClick={() =>
                      updateEnvironmentIcon(editingEnvironment, iconId)
                    }
                    style={{
                      color:
                        editingEnvironment.iconColor ??
                        DEFAULT_ENVIRONMENT_ICON_COLOR,
                    }}
                  >
                    <EnvironmentIcon iconId={iconId} />
                    {isSelected && (
                      <span className="icon-selected-badge" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </AsyncSearchState>
          <div className="color-options" role="group" aria-label="Icon colors">
            {ICON_COLOR_OPTIONS.map((color) => {
              const isColorSelected =
                (editingEnvironment.iconColor ??
                  DEFAULT_ENVIRONMENT_ICON_COLOR) === color
              return (
                <button
                  key={color}
                  className={`color-option-button${isColorSelected ? ' selected' : ''}`}
                  aria-label={`Select color ${color}`}
                  aria-pressed={isColorSelected}
                  onClick={() =>
                    updateEnvironmentIconColor(editingEnvironment, color)
                  }
                  style={{ backgroundColor: color }}
                />
              )
            })}
          </div>
        </ModalShell>
      )}
    </main>
  )
}
