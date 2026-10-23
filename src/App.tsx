import { useEffect, useMemo, useState } from 'react'
import {
  createEnvironment,
  deleteEnvironment,
  renameEnvironment,
  setEnvironmentIcon,
  setEnvironmentIconColor,
  toggleEnvironmentExpanded,
} from './domain/environments'
import type { Environment } from './domain/playback'
import { createEnvironmentPersistence } from './persistence/environments'
import {
  addCatalogItem,
  addCatalogPack,
  placeSound,
  removeSound,
  setSoundTiming,
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

function newEnvironmentId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `environment-${Date.now()}`
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
  const [environments, setEnvironments] = useState<Environment[]>(() =>
    persistence.load(),
  )
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => environments[0]?.id,
  )
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
  const [, setPlaybackRevision] = useState(0)
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

  const updateEnvironments = (next: Environment[]) => {
    setEnvironments(next)
    persistence.save(next)
  }

  const updateEnvironmentIcon = (environment: Environment, icon: string) => {
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id ? setEnvironmentIcon(item, icon) : item,
      ),
    )
  }

  const updateEnvironmentIconColor = (
    environment: Environment,
    iconColor: string,
  ) => {
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id
          ? setEnvironmentIconColor(item, iconColor)
          : item,
      ),
    )
  }

  const addEnvironment = () => {
    const environment = createEnvironment(newEnvironmentId(), 'New Environment')
    updateEnvironments([...environments, environment])
    setSelectedId(environment.id)
  }

  const renameEnvironmentInState = (environment: Environment, name: string) => {
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id ? renameEnvironment(item, name) : item,
      ),
    )
  }

  const removeEnvironment = (environmentId: string) => {
    const removed = environments.find((item) => item.id === environmentId)
    if (removed?.playing) playback.stop(removed)
    const next = deleteEnvironment(environments, environmentId)
    updateEnvironments(next)
    if (selectedId === environmentId) setSelectedId(next[0]?.id)
  }

  const toggleExpanded = (environment: Environment) => {
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id ? toggleEnvironmentExpanded(item) : item,
      ),
    )
  }

  const updateSelectedSounds = (sounds: Environment['sounds']) => {
    if (!selectedEnvironment) return
    const next = { ...selectedEnvironment, sounds }
    if (selectedEnvironment.playing) playback.sync(next)
    updateEnvironments(
      environments.map((item) =>
        item.id === selectedEnvironment.id ? next : item,
      ),
    )
  }

  const playEnvironment = (environment: Environment) => {
    const current = environments.find((item) => item.playing)
    if (current && current.id !== environment.id) playback.stop(current)
    playback.start(environment)
    updateEnvironments(
      environments.map((item) => ({
        ...item,
        playing: item.id === environment.id,
      })),
    )
  }

  const stopEnvironment = (environment: Environment) => {
    playback.stop(environment)
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id ? { ...item, playing: false } : item,
      ),
    )
  }

  const toggleCombat = (environment: Environment) => {
    const next = { ...environment, combatMode: !environment.combatMode }
    if (environment.playing) playback.toggleCombat(environment)
    updateEnvironments(
      environments.map((item) => (item.id === environment.id ? next : item)),
    )
  }

  const updateEnvironmentVolume = (
    environment: Environment,
    volume: number,
  ) => {
    const next = { ...environment, volume }
    if (environment.playing) playback.setEnvironmentVolume(next)
    updateEnvironments(
      environments.map((item) => (item.id === environment.id ? next : item)),
    )
  }

  const updateSoundVolume = (
    environment: Environment,
    sound: Environment['sounds'][number],
    volume: number,
  ) => {
    const sounds = environment.sounds.map((item) =>
      item.id === sound.id ? { ...item, volume } : item,
    )
    const next = { ...environment, sounds }
    if (environment.playing)
      playback.setSoundVolume({ ...sound, volume }, environment.volume)
    updateEnvironments(
      environments.map((item) => (item.id === environment.id ? next : item)),
    )
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
    const sounds = setSoundTiming(
      environment.sounds,
      sound.id,
      nextMinimum,
      nextMaximum,
    )
    const next = { ...environment, sounds }
    if (environment.playing) playback.sync(next)
    updateEnvironments(
      environments.map((item) => (item.id === environment.id ? next : item)),
    )
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Cross-platform audio workspace</p>
            <h1 id="app-title">Turbobard</h1>
            <p className="intro">
              Create and manage Environments for every tabletop scene.
            </p>
          </div>
          <button className="primary-button" onClick={addEnvironment}>
            Create Environment
          </button>
        </div>
        <div className="status-card" role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Ready for the first listening session. {environments.length}{' '}
            {environments.length === 1 ? 'Environment' : 'Environments'} saved.
          </span>
        </div>
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
        <section
          aria-labelledby="environments-heading"
          className="environment-panel"
        >
          <div className="section-heading">
            <h2 id="environments-heading">Environments</h2>
            <span>{environments.length}</span>
          </div>
          {environments.length === 0 ? (
            <p className="empty-state">
              No Environments yet. Create one to start building a scene.
            </p>
          ) : (
            <div className="environment-list" role="list">
              {environments.map((environment) => {
                const selected = selectedId === environment.id
                return (
                  <article
                    className={`environment-card${selected ? ' selected' : ''}`}
                    key={environment.id}
                    role="listitem"
                  >
                    <div className="environment-card-header">
                      <button
                        className="icon-trigger-button"
                        aria-label={`Select icon for ${environment.name}`}
                        data-icon={environment.icon ?? DEFAULT_ENVIRONMENT_ICON}
                        data-color={
                          environment.iconColor ??
                          DEFAULT_ENVIRONMENT_ICON_COLOR
                        }
                        onClick={() => {
                          setEditingIconEnvId(environment.id)
                          setIconQuery('')
                          setIconError(false)
                        }}
                        style={{
                          color:
                            environment.iconColor ??
                            DEFAULT_ENVIRONMENT_ICON_COLOR,
                        }}
                      >
                        <i
                          className={`fa-solid fa-fw fa-${environment.icon ?? DEFAULT_ENVIRONMENT_ICON}`}
                          aria-hidden="true"
                        />
                      </button>
                      <label
                        className="sr-only"
                        htmlFor={`name-${environment.id}`}
                      >
                        Environment name
                      </label>
                      <input
                        id={`name-${environment.id}`}
                        value={environment.name}
                        onChange={(event) =>
                          renameEnvironmentInState(
                            environment,
                            event.target.value,
                          )
                        }
                      />
                      <button
                        aria-pressed={selected}
                        className="secondary-button"
                        onClick={() => setSelectedId(environment.id)}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </button>
                      <button
                        className="primary-button"
                        onClick={() =>
                          environment.playing
                            ? stopEnvironment(environment)
                            : playEnvironment(environment)
                        }
                      >
                        {environment.playing ? 'Stop' : 'Play'}
                      </button>
                      {environment.playing && (
                        <button
                          className="secondary-button"
                          aria-pressed={environment.combatMode}
                          onClick={() => toggleCombat(environment)}
                        >
                          {environment.combatMode ? 'Combat on' : 'Combat off'}
                        </button>
                      )}
                    </div>
                    <div className="environment-actions">
                      <button
                        aria-expanded={environment.expanded}
                        className="text-button"
                        onClick={() => toggleExpanded(environment)}
                      >
                        {environment.expanded ? 'Collapse' : 'Expand'}
                      </button>
                      <button
                        className="text-button danger-button"
                        onClick={() => removeEnvironment(environment.id)}
                      >
                        Delete
                      </button>
                    </div>
                    {environment.expanded && (
                      <div className="environment-details">
                        <label>
                          Environment volume
                          <input
                            aria-label={`Volume for ${environment.name}`}
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={environment.volume}
                            onChange={(event) =>
                              updateEnvironmentVolume(
                                environment,
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
        <section className="catalog-panel" aria-labelledby="catalog-heading">
          <div className="section-heading">
            <h2 id="catalog-heading">Sound catalog</h2>
            <span>
              {selectedEnvironment
                ? `Editing ${selectedEnvironment.name}`
                : 'Select an Environment'}
            </span>
          </div>
          <label htmlFor="catalog-search">Search Sounds</label>
          <input
            id="catalog-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the catalog"
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
                  className="secondary-button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ),
            )}
          </div>
          {catalogLoading ? (
            <p role="status">Loading Sounds…</p>
          ) : catalogError ? (
            <div role="alert">
              Legacy sound catalog unavailable. Check your local API
              configuration and network access.{' '}
              <button
                className="text-button"
                onClick={() => setCatalogAttempt((attempt) => attempt + 1)}
              >
                Retry
              </button>
            </div>
          ) : results.length === 0 ? (
            <p className="empty-state">No Sounds found.</p>
          ) : (
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
                        addCatalogItem(selectedEnvironment?.sounds ?? [], item),
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
          )}
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
          {selectedEnvironment && (
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
                                background: `conic-gradient(#78e2ae ${state.fractionRemaining * 360}deg, #31466f 0deg)`,
                              }}
                            />
                          )
                        })()}
                    </span>
                    <input
                      aria-label={`Volume for ${sound.name ?? sound.id}`}
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={sound.volume}
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
                        <label>
                          Minimum interval (seconds)
                          <input
                            aria-label={`Minimum interval for ${sound.name ?? sound.id}`}
                            type="number"
                            min="0"
                            step="1"
                            value={sound.minIntervalSeconds ?? 0}
                            onChange={(event) =>
                              updateSoundTiming(
                                selectedEnvironment,
                                sound,
                                'minIntervalSeconds',
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <label>
                          Maximum interval (seconds)
                          <input
                            aria-label={`Maximum interval for ${sound.name ?? sound.id}`}
                            type="number"
                            min="0"
                            step="1"
                            value={
                              sound.maxIntervalSeconds ??
                              sound.minIntervalSeconds ??
                              0
                            }
                            onChange={(event) =>
                              updateSoundTiming(
                                selectedEnvironment,
                                sound,
                                'maxIntervalSeconds',
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <button
                          className="text-button"
                          onClick={() =>
                            playback.playManualOneShot(
                              selectedEnvironment,
                              sound,
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
          )}
        </section>
      </section>
      {editingEnvironment && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="icon-modal-title"
        >
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2 id="icon-modal-title">Select an icon</h2>
                <p className="modal-subtitle">{editingEnvironment.name}</p>
              </div>
              <button
                className="text-button"
                aria-label="Close icon picker"
                onClick={() => setEditingIconEnvId(null)}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              <label htmlFor="icon-search">Search icons</label>
              <input
                id="icon-search"
                value={iconQuery}
                onChange={(event) => setIconQuery(event.target.value)}
                placeholder="Search for icons"
              />
              {iconLoading ? (
                <p role="status">Loading icons…</p>
              ) : iconError ? (
                <div role="alert" className="icon-error">
                  Icon catalog unavailable. Check your local API configuration
                  and network access.{' '}
                  <button
                    className="text-button"
                    onClick={() => setIconAttempt((attempt) => attempt + 1)}
                  >
                    Retry
                  </button>
                </div>
              ) : displayedIcons.length === 0 ? (
                <p className="empty-state">
                  {iconQuery.trim()
                    ? `No icons found for "${iconQuery}".`
                    : 'No icons found.'}
                </p>
              ) : (
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
                        <i
                          className={`fa-solid fa-fw fa-${iconId}`}
                          aria-hidden="true"
                        />
                        {isSelected && (
                          <span
                            className="icon-selected-badge"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              <div
                className="color-options"
                role="group"
                aria-label="Icon colors"
              >
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
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
