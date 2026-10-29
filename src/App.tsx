import { Button } from './ui/Button'
import { PlaybackButton } from './ui/PlaybackButton'
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import logo from './assets/logo.svg'
import type { Environment } from './domain/playback'
import { createEnvironmentPersistence } from './persistence/environments'
import {
  placeSound,
  removeSound,
  type CatalogFilter,
  type CatalogResult,
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
import { Sound } from './ui/Sound'
import { CatalogPanel } from './ui/CatalogPanel'
import { ModalShell } from './ui/ModalShell'
import { NowPlayingBar } from './ui/NowPlayingBar'
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
  const [results, setResults] = useState<CatalogResult[]>([])
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
  const { environments, mostRecentlyPlayedEnvironmentId } =
    useSyncExternalStore(
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
  const mostRecentlyPlayedEnvironment = environments.find(
    (item) => item.id === mostRecentlyPlayedEnvironmentId,
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
            <h1 id="app-title">
              <img src={logo} alt="" className="app-logo" />
              <span className="sr-only">Turbobard</span>
            </h1>
          </div>
          <Button
            variant="ghost"
            iconOnly
            aria-label="About"
            onClick={() => setIsAboutOpen(true)}
          >
            <FontAwesomeIconView iconId="circle-info" />
          </Button>
        </header>
        {audioError && (
          <div role="alert" className="audio-error">
            {audioError}{' '}
            <Button variant="text" onClick={() => setAudioError(undefined)}>
              Dismiss
            </Button>
          </div>
        )}
        <div className={`workspace-body${isSearchOpen ? ' search-open' : ''}`}>
          <section
            aria-labelledby="environments-heading"
            className="environment-panel"
          >
            <div className="section-heading">
              <h2 id="environments-heading">Environments</h2>
              <div className="edit-mode-controls">
                {isEditMode && <span className="edit-mode-label">editing</span>}
                <Button
                  variant="ghost"
                  iconOnly={!isEditMode}
                  aria-label={isEditMode ? undefined : 'Edit environments'}
                  aria-pressed={isEditMode}
                  onClick={() => setIsEditMode((value) => !value)}
                >
                  <FontAwesomeIconView
                    iconId={isEditMode ? 'check' : 'pencil'}
                  />
                  {isEditMode && 'Done'}
                </Button>
              </div>
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
                    <div
                      className={`environment-tile-container${isEditMode ? ' is-editing' : ''}`}
                      key={environment.id}
                      role="listitem"
                    >
                      <button
                        className={`environment-tile${selected ? ' selected' : ''}${environment.playing ? ' playing' : ''}`}
                        aria-label={`${isEditMode ? 'Open' : environment.playing ? 'Stop' : 'Play'} ${environment.name}`}
                        style={
                          {
                            '--environment-color':
                              environment.iconColor ??
                              DEFAULT_ENVIRONMENT_ICON_COLOR,
                          } as CSSProperties
                        }
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
                            iconId={
                              environment.icon ?? DEFAULT_ENVIRONMENT_ICON
                            }
                          />
                        </span>
                        <span>{environment.name}</span>
                        {environment.playing && (
                          <span className="tile-playing" aria-label="Playing">
                            <FontAwesomeIconView iconId="volume-high" />
                          </span>
                        )}
                      </button>
                      {isEditMode && (
                        <Button
                          variant="ghost"
                          iconOnly
                          danger
                          className="environment-tile-delete"
                          aria-label={`Delete ${environment.name}`}
                          onClick={() => removeEnvironment(environment.id)}
                        >
                          <FontAwesomeIconView iconId="trash-can" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="environment-panel-footer">
              <Button variant="primary" onClick={addEnvironment}>
                Create Environment
              </Button>
            </div>
          </section>

          {selectedEnvironment && isEditorOpen && (
            <section
              className="environment-editor"
              aria-labelledby="editor-heading"
            >
              <h2 id="editor-heading" className="sr-only">
                {selectedEnvironment.name}
              </h2>
              <div className="environment-card selected">
                <div className="environment-card-header">
                  <Button
                    variant="ghost"
                    iconOnly
                    className="editor-back-button"
                    aria-label="Close Environment"
                    onClick={() => setIsEditorOpen(false)}
                  >
                    <FontAwesomeIconView iconId="arrow-left" />
                  </Button>
                  <Button
                    variant="secondary"
                    iconOnly
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
                  </Button>
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
                  <PlaybackButton
                    playing={selectedEnvironment.playing}
                    label={selectedEnvironment.playing ? 'Stop' : 'Play'}
                    onClick={() =>
                      selectedEnvironment.playing
                        ? stopEnvironment(selectedEnvironment)
                        : playEnvironment(selectedEnvironment)
                    }
                  />
                </div>
              </div>
              <div className="sound-list">
                {(['ambiance', 'combat'] as const).map((placement) => (
                  <section
                    className={`sound-section sound-section--${placement}`}
                    key={placement}
                    aria-label={
                      placement === 'combat'
                        ? 'Combat sounds'
                        : 'Non-combat sounds'
                    }
                  >
                    {placement === 'combat' && (
                      <>
                        <h3 className="combat-heading">
                          <FontAwesomeIconView iconId="hand-fist" /> Combat
                        </h3>
                        <p className="combat-description">
                          Sounds in this section replace the music and add to
                          the ambiance during Combat.
                        </p>
                      </>
                    )}
                    {(['loop', 'one-shot'] as const).map((kind) => {
                      const sounds = selectedEnvironment.sounds.filter(
                        (sound) =>
                          sound.placement === placement && sound.kind === kind,
                      )
                      return (
                        <section
                          className="sound-group"
                          key={kind}
                          aria-label={kind === 'loop' ? 'Music' : 'Ambiance'}
                        >
                          <h4>
                            <FontAwesomeIconView
                              iconId={
                                kind === 'loop' ? 'music' : 'cloud-sun-rain'
                              }
                            />{' '}
                            {kind === 'loop' ? 'Music' : 'Ambiance'}
                          </h4>
                          {sounds.length === 0 ? (
                            <p className="sound-group-empty">None</p>
                          ) : (
                            sounds.map((sound) => (
                              <Sound
                                key={sound.id}
                                sound={sound}
                                oneShotState={
                                  selectedEnvironment.playing &&
                                  sound.kind === 'one-shot'
                                    ? playback.oneShotState(sound.id)
                                    : undefined
                                }
                                onVolumeChange={(volume) =>
                                  updateSoundVolume(
                                    selectedEnvironment,
                                    sound,
                                    volume,
                                  )
                                }
                                onPlacementChange={(placement) =>
                                  updateSelectedSounds(
                                    placeSound(
                                      selectedEnvironment.sounds,
                                      sound.id,
                                      placement,
                                    ),
                                  )
                                }
                                onRemove={() =>
                                  updateSelectedSounds(
                                    removeSound(
                                      selectedEnvironment.sounds,
                                      sound.id,
                                    ),
                                  )
                                }
                                onTimingChange={(field, value) =>
                                  updateSoundTiming(
                                    selectedEnvironment,
                                    sound,
                                    field,
                                    value,
                                  )
                                }
                                onPlayNow={() =>
                                  workspace.playManualOneShot(
                                    selectedEnvironment.id,
                                    sound.id,
                                  )
                                }
                              />
                            ))
                          )}
                        </section>
                      )
                    })}
                  </section>
                ))}
              </div>
              <div className="add-sounds-footer">
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsSearchOpen(true)
                    requestAnimationFrame(() =>
                      document.getElementById('catalog-search')?.focus(),
                    )
                  }}
                >
                  <FontAwesomeIconView iconId="plus" /> Add sounds to
                  environment
                </Button>
              </div>
            </section>
          )}

          <CatalogPanel
            environment={selectedEnvironment}
            open={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            results={results}
            loading={catalogLoading}
            error={catalogError}
            onRetry={() => setCatalogAttempt((attempt) => attempt + 1)}
            onSoundsChange={updateSelectedSounds}
          />
        </div>
      </section>
      {mostRecentlyPlayedEnvironment && (
        <NowPlayingBar
          environment={mostRecentlyPlayedEnvironment}
          onPlay={() => playEnvironment(mostRecentlyPlayedEnvironment)}
          onStop={() => stopEnvironment(mostRecentlyPlayedEnvironment)}
          onToggleCombat={() => toggleCombat(mostRecentlyPlayedEnvironment)}
          onVolumeChange={(volume) =>
            updateEnvironmentVolume(mostRecentlyPlayedEnvironment, volume)
          }
        />
      )}
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
          headerContent={
            <div className="icon-search-field">
              <FontAwesomeIconView iconId="magnifying-glass" />
              <input
                id="icon-search"
                aria-label="Search icons"
                value={iconQuery}
                onChange={(event) => setIconQuery(event.target.value)}
                placeholder="Search for icons"
              />
            </div>
          }
          subtitle={
            <>
              Select icon for <strong>{editingEnvironment.name}</strong>
            </>
          }
          iconClose
          closeLabel="Close icon picker"
          onClose={() => setEditingIconEnvId(null)}
        >
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
                  <Button
                    variant="ghost"
                    iconOnly
                    key={iconId}
                    className={`icon-option-button${isSelected ? ' selected' : ''}`}
                    aria-label={iconId}
                    aria-pressed={isSelected}
                    onClick={() =>
                      updateEnvironmentIcon(editingEnvironment, iconId)
                    }
                    style={
                      {
                        '--icon-option-color':
                          editingEnvironment.iconColor ??
                          DEFAULT_ENVIRONMENT_ICON_COLOR,
                      } as CSSProperties
                    }
                  >
                    <EnvironmentIcon iconId={iconId} />
                  </Button>
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
                >
                  {isColorSelected && <FontAwesomeIconView iconId="check" />}
                </button>
              )
            })}
          </div>
        </ModalShell>
      )}
    </main>
  )
}
