import { Button } from './Button'
import type { ReactNode } from 'react'

export type AsyncSearchStateProps = {
  loading: boolean
  error: boolean
  empty: boolean
  loadingMessage: ReactNode
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
  errorMessage,
  emptyMessage,
  onRetry,
  errorClassName,
  children,
}: AsyncSearchStateProps) {
  if (loading) return <p role="status">{loadingMessage}</p>
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
