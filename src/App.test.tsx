import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('restores saved Environments without starting playback', async () => {
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
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      '1 Environment saved.',
    )
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

  it('searches the catalog and composes Sounds with placement and removal', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Sounds' }), {
      target: { value: 'rain' },
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getAllByText('Rainfall')[1]).toBeVisible()
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Placement for Rainfall' }),
      {
        target: { value: 'combat' },
      },
    )
    expect(
      screen.getByRole('combobox', { name: 'Placement for Rainfall' }),
    ).toHaveValue('combat')
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText('No Sounds added yet.')).toBeVisible()
  })
})
