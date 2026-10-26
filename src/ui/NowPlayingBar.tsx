import type { Environment } from '../domain/playback'
import {
  DEFAULT_ENVIRONMENT_ICON,
  DEFAULT_ENVIRONMENT_ICON_COLOR,
} from '../domain/icons'
import { Button } from './Button'
import { FontAwesomeIconView } from './icons'
import './NowPlayingBar.css'

export function NowPlayingBar({
  environment,
  onPlay,
  onStop,
  onToggleCombat,
}: {
  environment: Environment
  onPlay: () => void
  onStop: () => void
  onToggleCombat: () => void
}) {
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
      <label
        className={`now-playing-combat${environment.playing ? '' : ' is-disabled'}`}
      >
        <input
          type="checkbox"
          checked={environment.combatMode}
          disabled={!environment.playing}
          onChange={onToggleCombat}
        />
        <span className="now-playing-switch" aria-hidden="true">
          <span className="now-playing-thumb">
            <FontAwesomeIconView iconId="hand-fist" />
          </span>
        </span>
        <span>Combat</span>
      </label>
      <Button
        variant="ghost"
        iconOnly
        className="now-playing-play"
        aria-label={
          environment.playing ? 'Stop playback' : 'Play last environment'
        }
        onClick={environment.playing ? onStop : onPlay}
      >
        <svg
          className="now-playing-hexagon"
          viewBox="0 0 173.205 200"
          aria-hidden="true"
        >
          <path
            strokeWidth="5"
            d="M86.6025 0L173.205 50L173.205 150L86.6025 200L0 150L0 50Z"
          />
        </svg>
        <FontAwesomeIconView iconId={environment.playing ? 'pause' : 'play'} />
      </Button>
    </section>
  )
}
