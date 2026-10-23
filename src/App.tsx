import { useEffect, useMemo, useState } from 'react'
import {
  createEnvironment,
  deleteEnvironment,
  renameEnvironment,
  toggleEnvironmentExpanded,
} from './domain/environments'
import type { Environment } from './domain/playback'
import { createEnvironmentPersistence } from './persistence/environments'
import {
  addCatalogItem,
  addCatalogPack,
  catalogMatches,
  placeSound,
  removeSound,
  type CatalogFilter,
  type CatalogItem,
  type SoundCatalog,
} from './domain/catalog'
import { createPlaybackCoordinator } from './domain/coordinator'
import { createBrowserAudioPort } from './audio/browser'

const catalogItems: CatalogItem[] = [
  {
    id: 'rain',
    name: 'Rainfall',
    kind: 'loop',
    tags: ['weather', 'music'],
    source: {
      author: 'Turbobard Library',
      urls: ['https://example.test/rain'],
    },
  },
  {
    id: 'forest',
    name: 'Forest Ambiance',
    kind: 'loop',
    tags: ['nature', 'ambiance'],
    source: {
      author: 'Turbobard Library',
      urls: ['https://example.test/forest'],
    },
  },
  {
    id: 'thunder',
    name: 'Thunder Crack',
    kind: 'one-shot',
    tags: ['weather', 'ambiance'],
    variations: ['thunder-1'],
    source: {
      author: 'Turbobard Library',
      urls: ['https://example.test/thunder'],
    },
  },
]

const demoSoundCatalog: SoundCatalog = {
  search: async (query, filter) =>
    catalogItems.filter((item) => catalogMatches(item, query, filter)),
}

function newEnvironmentId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `environment-${Date.now()}`
}

export default function App() {
  const persistence = useMemo(
    () => createEnvironmentPersistence(window.localStorage),
    [],
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
  const selectedEnvironment = environments.find(
    (item) => item.id === selectedId,
  )
  const playback = useMemo(
    () =>
      createPlaybackCoordinator({
        audio: createBrowserAudioPort(),
        clock: {
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
  useEffect(() => () => playback.dispose(), [playback])
  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    setCatalogError(false)
    demoSoundCatalog
      .search(query, filter)
      .then((next) => active && setResults(next))
      .catch(() => active && setCatalogError(true))
      .finally(() => active && setCatalogLoading(false))
    return () => {
      active = false
    }
  }, [catalogAttempt, filter, query])

  const updateEnvironments = (next: Environment[]) => {
    setEnvironments(next)
    persistence.save(next)
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
    updateEnvironments(
      environments.map((item) =>
        item.id === selectedEnvironment.id ? { ...item, sounds } : item,
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
              Catalog unavailable.{' '}
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
                    <span>{sound.name ?? sound.id}</span>
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
                      <button
                        className="text-button"
                        onClick={() =>
                          playback.playManualOneShot(selectedEnvironment, sound)
                        }
                      >
                        Play now
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
