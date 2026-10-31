import { Button } from './ui/Button'
import { Welcome } from './ui/Welcome'
import { PlaybackButton } from './ui/PlaybackButton'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import logo from './assets/logo.svg'
import { flushSync } from 'react-dom'
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
import { selectAllTextOnFocus } from './ui/selectAllTextOnFocus'
import { buildInfo } from './buildInfo'
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
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 900px)')
    const closeMobileSearch = () => {
      if (desktop?.matches) setIsSearchOpen(false)
    }
    desktop?.addEventListener('change', closeMobileSearch)
    return () => desktop?.removeEventListener('change', closeMobileSearch)
  }, [])
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
  const editorRef = useRef<HTMLElement>(null)
  const environmentPanelRef = useRef<HTMLElement>(null)
  const createTileRef = useRef<HTMLButtonElement>(null)
  const [isCreateTileVisible, setIsCreateTileVisible] = useState(true)
  useEffect(() => {
    const tile = createTileRef.current
    const panel = environmentPanelRef.current
    if (!tile || !panel || !window.IntersectionObserver) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsCreateTileVisible(entry.isIntersecting),
      { root: panel },
    )
    observer.observe(tile)
    return () => observer.disconnect()
  }, [environments.length])
  const headerLogoRef = useRef<HTMLImageElement>(null)
  const welcomeLogoRef = useRef<HTMLImageElement>(null)
  const logoOriginRef = useRef<DOMRect | undefined>(undefined)
  const isWelcome = environments.length === 0
  useLayoutEffect(() => {
    const origin = logoOriginRef.current
    logoOriginRef.current = undefined
    const image = headerLogoRef.current
    if (isWelcome || !origin || !image || !image.animate) return
    if (!(window.matchMedia?.('(min-width: 900px)').matches ?? true)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const target = image.getBoundingClientRect()
    const animation = image.animate(
      [
        {
          transform: `translate(${origin.x - target.x}px, ${origin.y - target.y}px) scale(${origin.width / target.width})`,
          zIndex: 20,
        },
        { transform: 'none', zIndex: 20 },
      ],
      { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
    return () => animation.cancel()
  }, [isWelcome])
  const selectedTileRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isEditorOpen && editorRef.current?.contains(document.activeElement)) {
      selectedTileRef.current?.focus()
    }
  }, [isEditorOpen])
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
    if (isWelcome) {
      logoOriginRef.current = welcomeLogoRef.current?.getBoundingClientRect()
    }
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
    <main className={`app-shell${isWelcome ? ' is-welcome' : ''}`}>
      <section className="workspace" aria-labelledby="app-title">
        <header className="app-header">
          <div>
            <h1 id="app-title">
              <img ref={headerLogoRef} src={logo} alt="" className="app-logo" />
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
        <div
          className={`workspace-body${isEditorOpen && selectedEnvironment ? ' editor-open' : ''}${isSearchOpen ? ' search-open' : ''}`}
        >
          {environments.length === 0 ? (
            <Welcome
              logoRef={welcomeLogoRef}
              onAddEnvironment={addEnvironment}
            />
          ) : (
            <section
              aria-labelledby="environments-heading"
              className="environment-panel"
              ref={environmentPanelRef}
            >
              <div className="section-heading">
                <h2 id="environments-heading">Environments</h2>
                <div className="edit-mode-controls">
                  {isEditMode && (
                    <span className="edit-mode-label">Editing</span>
                  )}
                  <Button
                    variant={isEditMode ? 'primary' : 'ghost'}
                    iconOnly={!isEditMode}
                    aria-label={isEditMode ? undefined : 'Edit environments'}
                    aria-pressed={isEditMode}
                    onClick={() => setIsEditMode((value) => !value)}
                  >
                    <FontAwesomeIconView
                      iconId={isEditMode ? 'check' : 'wrench'}
                    />
                    {isEditMode && 'Done'}
                  </Button>
                </div>
              </div>
              <div
                className={`edit-mode-hint${isEditMode ? ' is-visible' : ''}`}
                aria-hidden={!isEditMode}
              >
                <p className="edit-mode-label">
                  Tap or click an environment to modify it
                </p>
              </div>
              <div className="environment-list" role="list">
                {environments.map((environment) => {
                  const selected = selectedId === environment.id && isEditorOpen
                  return (
                    <div
                      className={`environment-tile-container${isEditMode ? ' is-editing' : ''}${selected ? ' selected' : ''}${environment.playing ? ' playing' : ''}`}
                      key={environment.id}
                      role="listitem"
                      style={
                        {
                          '--environment-color':
                            environment.iconColor ??
                            DEFAULT_ENVIRONMENT_ICON_COLOR,
                        } as CSSProperties
                      }
                    >
                      <button
                        ref={
                          selectedId === environment.id
                            ? selectedTileRef
                            : undefined
                        }
                        className={`environment-tile${selected ? ' selected' : ''}${environment.playing ? ' playing' : ''}`}
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
                            iconId={
                              environment.icon ?? DEFAULT_ENVIRONMENT_ICON
                            }
                          />
                          <span
                            className="environment-tile-action"
                            aria-hidden="true"
                          >
                            <FontAwesomeIconView
                              iconId={
                                isEditMode
                                  ? 'wrench'
                                  : environment.playing
                                    ? 'pause'
                                    : 'play'
                              }
                            />
                          </span>
                        </span>
                        <span className="environment-tile-name">
                          {environment.name}
                        </span>
                        {environment.playing && (
                          <>
                            <span className="sr-only" aria-label="Playing">
                              Playing
                            </span>
                            <span className="tile-equalizer" aria-hidden="true">
                              {Array.from({ length: 14 }, (_, index) => (
                                <i
                                  key={index}
                                  style={
                                    {
                                      '--bar-duration': `${2000 + ((index * 397) % 1100) * 2}ms`,
                                      '--bar-delay': `${-((index * 613) % 2100) * 2}ms`,
                                      height: `${45 + ((index * 37) % 55)}%`,
                                    } as CSSProperties
                                  }
                                />
                              ))}
                            </span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="environment-tile-delete"
                        disabled={!isEditMode}
                        aria-hidden={!isEditMode}
                        aria-label={`Delete ${environment.name}`}
                        onClick={() => removeEnvironment(environment.id)}
                      >
                        <FontAwesomeIconView iconId="trash-can" />
                      </button>
                    </div>
                  )
                })}
                <div
                  className="environment-tile-container environment-create-container"
                  role="listitem"
                >
                  <button
                    ref={createTileRef}
                    type="button"
                    className="environment-tile environment-create-tile"
                    onClick={addEnvironment}
                  >
                    <span className="environment-tile-icon">
                      <FontAwesomeIconView iconId="plus" />
                    </span>
                    <span className="environment-tile-name">
                      Create Environment
                    </span>
                  </button>
                </div>
              </div>
              {!isCreateTileVisible && (
                <div className="environment-panel-footer">
                  <Button variant="primary" onClick={addEnvironment}>
                    <FontAwesomeIconView iconId="plus" /> Create Environment
                  </Button>
                </div>
              )}
            </section>
          )}

          {selectedEnvironment && (
            <section
              ref={editorRef}
              className="environment-editor"
              aria-labelledby="editor-heading"
              aria-hidden={!isEditorOpen || isSearchOpen}
              inert={!isEditorOpen || isSearchOpen}
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
                    onClick={() => {
                      setIsEditorOpen(false)
                      selectedTileRef.current?.focus({ preventScroll: true })
                    }}
                  >
                    <FontAwesomeIconView iconId="arrow-left" />
                  </Button>
                  <Button
                    variant="secondary"
                    iconOnly
                    className="environment-icon-edit"
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
                    <span
                      className="environment-icon-edit-badge"
                      aria-hidden="true"
                    >
                      <FontAwesomeIconView iconId="pencil" />
                    </span>
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
                    onFocus={selectAllTextOnFocus}
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
                      <div className="combat-section-header">
                        <h3 className="combat-heading">
                          <FontAwesomeIconView iconId="hand-fist" /> Combat
                        </h3>
                        <p className="combat-description">
                          Sounds in this section replace the music and add to
                          the ambiance during Combat.
                        </p>
                      </div>
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
                    flushSync(() =>
                      setIsSearchOpen(
                        window.matchMedia?.('(max-width: 899px)').matches ??
                          false,
                      ),
                    )
                    document
                      .getElementById('catalog-search')
                      ?.focus({ preventScroll: true })
                  }}
                >
                  <FontAwesomeIconView iconId="magnifying-glass" /> Add sounds
                  to environment
                </Button>
              </div>
            </section>
          )}

          {environments.length > 0 && (
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
          )}
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
                If you'd like, you can{' '}
                <a
                  className="about-donate"
                  href="https://ko-fi.com/projectbench"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  donate
                </a>{' '}
                to help cover the costs of running it.
              </p>
              <a
                className="button button--primary about-support"
                href="https://ko-fi.com/projectbench"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FontAwesomeIconView iconId="hand-holding-dollar" />
                Support me
              </a>
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
              <p>
                If TurboBard features your sound and you'd like it to be removed
                or modified for any reason, please contact me at{' '}
                <a href="mailto:phanarydev@gmail.com">phanarydev@gmail.com</a>
              </p>
            </section>
            <section>
              <h3>Contact me.</h3>
              <p>
                Please send any feedback, bugs, or ideas to{' '}
                <a href="mailto:phanarydev@gmail.com">phanarydev@gmail.com</a>
              </p>
            </section>
            <details className="about-build-info">
              <summary>Build information</summary>
              <dl className="build-info">
                <dt>Source commit</dt>
                <dd data-testid="build-commit">
                  {buildInfo.commit.slice(0, 7)}
                </dd>
                <dt>CI build ID</dt>
                <dd data-testid="build-id">{buildInfo.buildId}</dd>
                <dt>Built at (UTC)</dt>
                <dd data-testid="build-time">{buildInfo.builtAt}</dd>
              </dl>
            </details>
          </div>
        </ModalShell>
      )}
      {editingEnvironment && (
        <ModalShell
          title="Select an icon"
          titleId="icon-modal-title"
          className="icon-picker-card"
          headerContent={
            <div className="icon-search-field">
              <FontAwesomeIconView iconId="magnifying-glass" />
              <input
                id="icon-search"
                aria-label="Search icons"
                value={iconQuery}
                onFocus={selectAllTextOnFocus}
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
          closeLabel="Close icon picker"
          onClose={() => setEditingIconEnvId(null)}
        >
          <div className="icon-picker-results">
            <AsyncSearchState
              loading={iconLoading}
              error={iconError}
              empty={displayedIcons.length === 0}
              loadingMessage="Loading icons…"
              loadingContent={
                <div
                  className="icon-grid icon-skeleton-grid"
                  aria-hidden="true"
                >
                  {Array.from({ length: 36 }, (_, index) => (
                    <span className="icon-skeleton" key={index} />
                  ))}
                </div>
              }
              errorMessage={
                <>
                  Icon catalog unavailable. Check your local API configuration
                  and network access.
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
          </div>
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
                >
                  <span
                    className="color-option-swatch"
                    style={{ backgroundColor: color }}
                  >
                    {isColorSelected && <FontAwesomeIconView iconId="check" />}
                  </span>
                </button>
              )
            })}
          </div>
        </ModalShell>
      )}
    </main>
  )
}
