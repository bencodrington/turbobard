import { Button } from './Button'
import { useEffect, type ReactNode } from 'react'

export type ModalShellProps = {
  title: string
  titleId: string
  subtitle?: ReactNode
  className?: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}

export function ModalShell({
  title,
  titleId,
  subtitle,
  className = '',
  closeLabel,
  onClose,
  children,
}: ModalShellProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`modal-card${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <Button variant="text" aria-label={closeLabel} onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
