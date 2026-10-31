import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Placement, Sound as EnvironmentSound } from '../domain/playback'
import type { OneShotState } from '../domain/coordinator'
import { Button } from './Button'
import { LabeledNumberField, LabeledRangeField } from './LabeledFields'
import { ModalShell } from './ModalShell'
import { FontAwesomeIconView } from './icons'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'source' | 'timing'>()
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const name = sound.name ?? sound.id
  const seconds = (oneShotState?.remainingMs ?? 0) / 1_000
  const remainingLabel =
    seconds < 1 ? '<1 second' : `${Math.ceil(seconds)} seconds`
  const sources = [...new Set(sound.attributionUrls ?? [])]
  const closeModal = useCallback(() => {
    setModal(undefined)
    if (modal === 'timing') editButtonRef.current?.focus()
    else menuButtonRef.current?.focus()
  }, [modal])

  useEffect(() => {
    if (!modal) return
    const dialog = document
      .getElementById(`${id}-modal-title`)
      ?.closest('[role="dialog"]')
    if (!dialog) return
    const controls = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>('button, input, a[href]'))
    ;(dialog.querySelector<HTMLElement>('input') ?? controls()[0])?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        closeModal()
        return
      }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', trapFocus, true)
    return () => document.removeEventListener('keydown', trapFocus, true)
  }, [modal, id, closeModal])

  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape, true)
    }
  }, [menuOpen])

  return (
    <div className="sound-row">
      <div className="sound-header">
        <span className="sound-name">{name}</span>
        <div
          className="sound-menu"
          ref={menuRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setMenuOpen(false)
          }}
        >
          <Button
            variant="ghost"
            iconOnly
            ref={menuButtonRef}
            aria-label={`Sound options for ${name}`}
            aria-expanded={menuOpen}
            aria-controls={`${id}-actions`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <FontAwesomeIconView iconId="ellipsis-vertical" />
          </Button>
          {menuOpen && (
            <div
              className="sound-menu-actions"
              id={`${id}-actions`}
              role="group"
              aria-label={`Actions for ${name}`}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setMenuOpen(false)
                  onPlacementChange(
                    sound.placement === 'combat' ? 'ambiance' : 'combat',
                  )
                }}
              >
                <span className="sound-placement-icon" aria-hidden="true">
                  <FontAwesomeIconView iconId="hand-fist" />
                  {sound.placement === 'combat' && (
                    <FontAwesomeIconView
                      iconId="slash"
                      className="sound-placement-slash"
                    />
                  )}
                </span>
                Move to {sound.placement === 'combat' ? 'non-combat' : 'combat'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setMenuOpen(false)
                  setModal('source')
                }}
              >
                <FontAwesomeIconView iconId="circle-info" />
                Audio source
              </Button>
              <Button variant="secondary" danger onClick={onRemove}>
                <FontAwesomeIconView iconId="trash-can" />
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>
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
        {sound.kind === 'one-shot' ? (
          <div
            className="one-shot-controls"
            role="group"
            aria-label={`One-shot controls for ${name}`}
          >
            <Button
              variant="secondary"
              iconOnly
              className="one-shot-edit"
              ref={editButtonRef}
              aria-label={`Edit intervals for ${name}`}
              title="Edit intervals"
              onClick={() => setModal('timing')}
            >
              <span
                className={oneShotState ? 'one-shot-wick' : 'one-shot-idle'}
                role="img"
                aria-label={
                  oneShotState
                    ? `${name}: next sound in ${remainingLabel}`
                    : `${name}: not scheduled`
                }
                title={
                  oneShotState
                    ? `Next sound in ${remainingLabel}`
                    : 'Not scheduled'
                }
                style={
                  oneShotState
                    ? {
                        background: `conic-gradient(var(--accent) ${(oneShotState?.fractionRemaining ?? 0) * 360}deg, var(--border-strong) 0deg)`,
                      }
                    : undefined
                }
              >
                {!oneShotState && <FontAwesomeIconView iconId="stopwatch" />}
              </span>
              <span className="one-shot-edit-badge" aria-hidden="true">
                <FontAwesomeIconView iconId="pen" />
              </span>
            </Button>
            <Button
              variant="secondary"
              iconOnly
              className="one-shot-play"
              aria-label="Play now"
              title="Play now"
              onClick={onPlayNow}
            >
              <FontAwesomeIconView iconId="play" />
              <span className="one-shot-count" aria-hidden="true">
                1
              </span>
            </Button>
          </div>
        ) : (
          <span className="sound-loop-label">ongoing loop</span>
        )}
      </div>
      {modal &&
        createPortal(
          <ModalShell
            title={modal === 'timing' ? 'One-shot intervals' : 'Audio source'}
            titleId={`${id}-modal-title`}
            subtitle={name}
            closeLabel={`Close ${modal === 'timing' ? 'intervals' : 'audio source'}`}
            onClose={closeModal}
          >
            {modal === 'timing' ? (
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
                    onTimingChange(
                      'minIntervalSeconds',
                      Number(event.target.value),
                    )
                  }
                />
                <LabeledNumberField
                  label="Maximum interval (seconds)"
                  value={
                    sound.maxIntervalSeconds ?? sound.minIntervalSeconds ?? 0
                  }
                  inputProps={{
                    'aria-label': `Maximum interval for ${name}`,
                    min: 0,
                    step: 1,
                  }}
                  onChange={(event) =>
                    onTimingChange(
                      'maxIntervalSeconds',
                      Number(event.target.value),
                    )
                  }
                />
              </div>
            ) : (
              <div className="sound-source">
                {sound.source?.author && <p>Author: {sound.source.author}</p>}
                {sources.length ? (
                  <ul>
                    {sources.map((url) => (
                      <li key={url}>
                        {/^https?:\/\//i.test(url) ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {url}
                          </a>
                        ) : (
                          url
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No audio source available.</p>
                )}
              </div>
            )}
          </ModalShell>,
          document.body,
        )}
    </div>
  )
}
