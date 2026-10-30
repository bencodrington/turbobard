import { Button } from './Button'
import { FontAwesomeIconView } from './icons'
import { useEffect, type ReactNode } from 'react'

export type ModalShellProps = {
  title: string
  titleId: string
  headerContent?: ReactNode
  subtitle?: ReactNode
  className?: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}

export function ModalShell({
  title,
  titleId,
  headerContent,
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
          <div className="modal-header-content">
            <h2 id={titleId} className={headerContent ? 'sr-only' : undefined}>
              {title}
            </h2>
            {headerContent}
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <Button
            variant="ghost"
            iconOnly
            aria-label={closeLabel}
            onClick={onClose}
          >
            <FontAwesomeIconView iconId="xmark" />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
