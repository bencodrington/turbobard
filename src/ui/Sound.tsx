import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Placement, Sound as EnvironmentSound } from '../domain/playback'
import type { OneShotState } from '../domain/coordinator'
import { Button } from './Button'
import { ButtonGroup } from './ButtonGroup'
import {
  intervalPresets,
  variationPresets,
  nearestPreset,
  soundTiming,
} from '../domain/oneShotTiming'
import { LabeledRangeField } from './LabeledFields'
import { ModalShell } from './ModalShell'
import { FontAwesomeIconView } from './icons'

type SoundProps = {
  sound: EnvironmentSound
  oneShotState?: OneShotState
  onVolumeChange: (volume: number) => void
  onPlacementChange: (placement: Placement) => void
  onTimingChange: (intervalSeconds: number, variationSeconds: number) => void
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
  const timing = soundTiming(sound)
  const minimum = sound.minIntervalSeconds ?? 0
  const maximum = sound.maxIntervalSeconds ?? minimum
  const chooseTiming = (
    field: 'intervalSeconds' | 'variationSeconds',
    value: number,
  ) => {
    onTimingChange(
      field === 'intervalSeconds'
        ? value
        : nearestPreset(timing.intervalSeconds, intervalPresets),
      field === 'variationSeconds'
        ? value
        : nearestPreset(timing.variationSeconds, variationPresets),
    )
  }
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
    ;(
      dialog.querySelector<HTMLElement>(
        '.sound-timing button[aria-pressed="true"]',
      ) ??
      dialog.querySelector<HTMLElement>('.sound-timing button, input') ??
      controls()[0]
    )?.focus()
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
            title={modal === 'timing' ? 'Adjust timing' : 'Audio source'}
            titleId={`${id}-modal-title`}
            subtitle={
              modal === 'timing' ? (
                <>
                  Control how often <strong>{name}</strong> plays
                </>
              ) : (
                name
              )
            }
            closeLabel={`Close ${modal === 'timing' ? 'intervals' : 'audio source'}`}
            onClose={closeModal}
          >
            {modal === 'timing' ? (
              <div className="sound-timing">
                <div className="timing-control">
                  <p>Play every</p>
                  <ButtonGroup
                    label="Play every"
                    value={timing.intervalSeconds}
                    options={intervalPresets.map((value) => ({
                      value,
                      label: (
                        <>
                          <strong>{value}</strong>
                          <span className="timing-unit">s</span>
                        </>
                      ),
                    }))}
                    onChange={(value) => chooseTiming('intervalSeconds', value)}
                  />
                </div>
                <div className="timing-control">
                  <p>Give or take</p>
                  <ButtonGroup
                    label="Give or take"
                    value={timing.variationSeconds}
                    options={variationPresets.map((value) => ({
                      value,
                      label: (
                        <>
                          <strong>{value}</strong>
                          <span className="timing-unit">s</span>
                        </>
                      ),
                    }))}
                    onChange={(value) =>
                      chooseTiming('variationSeconds', value)
                    }
                  />
                </div>
                <div className="timing-result" role="status" aria-live="polite">
                  <p>
                    ...every <strong>{minimum}</strong>
                    {minimum !== maximum && (
                      <>
                        {' '}
                        to <strong>{maximum}</strong>
                      </>
                    )}{' '}
                    {minimum === maximum && minimum === 1
                      ? 'second'
                      : 'seconds'}
                    .
                  </p>
                </div>
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
