import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('Environment workspace', () => {
  beforeEach(() => localStorage.clear())

  it('lets a user create, rename, select, collapse, expand, and delete an Environment', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))
    const name = screen.getByRole('textbox', { name: 'Environment name' })
    fireEvent.change(name, { target: { value: 'Ruined Keep' } })

    expect(screen.getByDisplayValue('Ruined Keep')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.getByRole('button', { name: 'Expand' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByText(/no environments yet/i)).toBeVisible()
  })

  it('restores saved Environments without starting playback', () => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'forest',
            name: 'Forest',
            expanded: true,
            sounds: [],
            playing: true,
            combatMode: true,
          },
        ],
      }),
    )

    render(<App />)

    expect(screen.getByDisplayValue('Forest')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('1 Environment saved.')
  })

  it('does not construct audio while restoring Environments', () => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [{ id: 'forest', name: 'Forest' }],
      }),
    )
    const audio = vi.spyOn(window, 'Audio')

    render(<App />)

    expect(audio).not.toHaveBeenCalled()
    audio.mockRestore()
  })

  it('persists Environment edits through the versioned boundary', () => {
    const { unmount } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Environment name' }),
      {
        target: { value: 'Persisted Scene' },
      },
    )
    unmount()
    render(<App />)

    expect(screen.getByDisplayValue('Persisted Scene')).toBeVisible()
    expect(JSON.parse(localStorage.getItem('environments')!)).toMatchObject({
      version: 1,
      environments: [{ name: 'Persisted Scene' }],
    })
  })
})
