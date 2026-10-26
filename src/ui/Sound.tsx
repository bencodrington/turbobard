import type { Placement, Sound as EnvironmentSound } from '../domain/playback'
import type { OneShotState } from '../domain/coordinator'
import { Button } from './Button'

import { LabeledNumberField, LabeledRangeField } from './LabeledFields'

type SoundProps = {
  sound: EnvironmentSound
  oneShotState?: OneShotState
  onVolumeChange: (volume: number) => void
  onPlacementChange: (placement: Placement) => void
  onTimingChange: (
    field: 'minIntervalSeconds' | 'maxIntervalSeconds',
    value: number,
  ) => void
  onRemove: () => void
  onPlayNow: () => void
}

export function Sound({
  sound,
  oneShotState,
  onVolumeChange,
  onPlacementChange,
  onTimingChange,
  onRemove,
  onPlayNow,
}: SoundProps) {
  const name = sound.name ?? sound.id
  const seconds = (oneShotState?.remainingMs ?? 0) / 1_000
  const remainingLabel =
    seconds < 1 ? '<1 second' : `${Math.ceil(seconds)} seconds`

  return (
    <div className="sound-row">
      <span className="sound-name">
        <span>{name}</span>
        {sound.kind === 'one-shot' && oneShotState && (
          <span
            className="one-shot-wick"
            role="img"
            aria-label={`${name}: next sound in ${remainingLabel}`}
            title={`Next sound in ${remainingLabel}`}
            style={{
              background: `conic-gradient(var(--accent) ${oneShotState.fractionRemaining * 360}deg, var(--border-strong) 0deg)`,
            }}
          />
        )}
      </span>
      <div className="sound-controls">
        <LabeledRangeField
          label={null}
          value={sound.volume}
          inputProps={{
            'aria-label': `Volume for ${name}`,
            min: 0,
            max: 1,
            step: 0.01,
          }}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
        <select
          aria-label={`Placement for ${name}`}
          value={sound.placement}
          onChange={(event) =>
            onPlacementChange(event.target.value as Placement)
          }
        >
          <option value="ambiance">Ambiance</option>
          <option value="combat">Combat</option>
        </select>
        <Button variant="text" danger onClick={onRemove}>
          Remove
        </Button>
      </div>
      {sound.kind === 'one-shot' && (
        <div className="sound-timing">
          <LabeledNumberField
            label="Minimum interval (seconds)"
            value={sound.minIntervalSeconds ?? 0}
            inputProps={{
              'aria-label': `Minimum interval for ${name}`,
              min: 0,
              step: 1,
            }}
            onChange={(event) =>
              onTimingChange('minIntervalSeconds', Number(event.target.value))
            }
          />
          <LabeledNumberField
            label="Maximum interval (seconds)"
            value={sound.maxIntervalSeconds ?? sound.minIntervalSeconds ?? 0}
            inputProps={{
              'aria-label': `Maximum interval for ${name}`,
              min: 0,
              step: 1,
            }}
            onChange={(event) =>
              onTimingChange('maxIntervalSeconds', Number(event.target.value))
            }
          />
          <Button variant="text" onClick={onPlayNow}>
            Play now
          </Button>
        </div>
      )}
    </div>
  )
}
