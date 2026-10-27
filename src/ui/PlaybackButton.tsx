import { Button } from './Button'
import { FontAwesomeIconView } from './icons'
import './PlaybackButton.css'

export function PlaybackButton({
  playing,
  label,
  onClick,
}: {
  playing: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      iconOnly
      className={`playback-button${playing ? ' is-playing' : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <svg
        className="playback-button-hexagon"
        viewBox="0 0 173.205 200"
        aria-hidden="true"
      >
        <path
          strokeWidth="5"
          d="M86.6025 0L173.205 50L173.205 150L86.6025 200L0 150L0 50Z"
        />
      </svg>
      <FontAwesomeIconView iconId={playing ? 'pause' : 'play'} />
    </Button>
  )
}
