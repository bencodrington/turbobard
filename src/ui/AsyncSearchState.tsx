import { Button } from './Button'
import type { ReactNode } from 'react'

export type AsyncSearchStateProps = {
  loading: boolean
  error: boolean
  empty: boolean
  loadingMessage: ReactNode
  loadingContent?: ReactNode
  errorMessage: ReactNode
  emptyMessage: ReactNode
  onRetry: () => void
  errorClassName?: string
  children: ReactNode
}

export function AsyncSearchState({
  loading,
  error,
  empty,
  loadingMessage,
  loadingContent,
  errorMessage,
  emptyMessage,
  onRetry,
  errorClassName,
  children,
}: AsyncSearchStateProps) {
  if (loading)
    return loadingContent ? (
      <div role="status">
        <span className="sr-only">{loadingMessage}</span>
        {loadingContent}
      </div>
    ) : (
      <p role="status">{loadingMessage}</p>
    )
  if (error)
    return (
      <div role="alert" className={errorClassName}>
        {errorMessage}{' '}
        <Button variant="text" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  if (empty) return emptyMessage
  return children
}
