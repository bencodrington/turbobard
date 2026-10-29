import type { FocusEvent } from 'react'

export function selectAllTextOnFocus(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget

  if (
    !['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(
      input.type,
    )
  ) {
    return
  }

  try {
    input.select()
  } catch (error) {
    // Some browsers expose select() but do not support selection for number
    // inputs. Keep their normal focus behavior in that case.
    if (error instanceof DOMException && error.name === 'InvalidStateError') {
      return
    }
    throw error
  }
}
