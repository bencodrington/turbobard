import type { Environment } from '../domain/playback'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './Button'
import { CombatToggle } from './CombatToggle'
import {
  DEFAULT_ENVIRONMENT_ICON,
  DEFAULT_ENVIRONMENT_ICON_COLOR,
} from '../domain/icons'
import { PlaybackButton } from './PlaybackButton'
import { FontAwesomeIconView } from './icons'
import './NowPlayingBar.css'

export function NowPlayingBar({
  environment,
  onPlay,
  onStop,
  onToggleCombat,
  onVolumeChange,
}: {
  environment: Environment
  onPlay: () => void
  onStop: () => void
  onToggleCombat: () => void
  onVolumeChange: (volume: number) => void
}) {
  const [volumeOpen, setVolumeOpen] = useState(false)
  const volumeRef = useRef<HTMLDivElement>(null)
  const sliderId = useId()

  useEffect(() => {
    if (!volumeOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!volumeRef.current?.contains(event.target as Node))
        setVolumeOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVolumeOpen(false)
        volumeRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [volumeOpen])

  return (
    <section
      aria-label="Now playing"
      className={`now-playing-bar${environment.playing ? ' is-playing' : ''}`}
    >
      <span className="now-playing-border" aria-hidden="true" />
      <span className="now-playing-name">
        <span
          className="now-playing-icon"
          style={{
            color: environment.iconColor ?? DEFAULT_ENVIRONMENT_ICON_COLOR,
          }}
        >
          <FontAwesomeIconView
            iconId={environment.icon ?? DEFAULT_ENVIRONMENT_ICON}
          />
        </span>
        <span>{environment.name}</span>
      </span>
      <div className="now-playing-volume" ref={volumeRef}>
        <span className="volume-inline-icon" aria-hidden="true">
          <FontAwesomeIconView iconId="volume-high" />
        </span>
        <Button
          variant="ghost"
          iconOnly
          className="volume-toggle"
          aria-label="Environment volume"
          aria-expanded={volumeOpen}
          aria-controls={sliderId}
          onClick={() => setVolumeOpen((open) => !open)}
        >
          <FontAwesomeIconView iconId="volume-high" />
        </Button>
        <div
          id={sliderId}
          className={`volume-slider${volumeOpen ? ' is-open' : ''}`}
        >
          <input
            type="range"
            aria-label={`Volume for ${environment.name}`}
            min={0}
            max={1}
            step={0.01}
            value={environment.volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </div>
      </div>
      <CombatToggle
        label="Combat"
        checked={environment.combatMode}
        disabled={!environment.playing}
        onChange={onToggleCombat}
      />
      <PlaybackButton
        playing={environment.playing}
        label={environment.playing ? 'Stop playback' : 'Play last environment'}
        onClick={environment.playing ? onStop : onPlay}
      />
    </section>
  )
}
