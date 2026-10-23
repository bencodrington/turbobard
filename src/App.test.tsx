import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('Environment workspace', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

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

  it('lets users adjust One-shot timing', () => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'forest',
            name: 'Forest',
            sounds: [
              {
                id: 'owl',
                name: 'Owl',
                kind: 'one-shot',
                placement: 'ambiance',
                volume: 1,
                variations: ['owl.mp3'],
                minIntervalSeconds: 2,
                maxIntervalSeconds: 6,
              },
            ],
          },
        ],
      }),
    )

    render(<App />)

    const minimum = screen.getByRole('spinbutton', {
      name: 'Minimum interval for Owl',
    })
    const maximum = screen.getByRole('spinbutton', {
      name: 'Maximum interval for Owl',
    })
    fireEvent.change(minimum, { target: { value: '3' } })
    fireEvent.change(maximum, { target: { value: '8' } })

    expect(minimum).toHaveValue(3)
    expect(maximum).toHaveValue(8)
    expect(JSON.parse(localStorage.getItem('environments')!)).toMatchObject({
      environments: [
        {
          sounds: [{ minIntervalSeconds: 3, maxIntervalSeconds: 8 }],
        },
      ],
    })
  })

  it('plays a One-shot immediately while its Environment is stopped', () => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'forest',
            name: 'Forest',
            sounds: [
              {
                id: 'owl',
                name: 'Owl',
                kind: 'one-shot',
                placement: 'ambiance',
                volume: 1,
                variations: ['owl.mp3'],
              },
            ],
          },
        ],
      }),
    )
    const play = vi.fn(() => Promise.resolve())
    vi.spyOn(window, 'Audio').mockImplementation(function MockAudio() {
      return {
        volume: 1,
        play,
        addEventListener: vi.fn(),
      } as unknown as HTMLAudioElement
    } as unknown as typeof Audio)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Play now' }))

    expect(play).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Play' })).toBeVisible()
  })

  it('shows the legacy catalog failure state', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'))
    render(<App />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Sounds' }), {
      target: { value: 'rain' },
    })
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /legacy sound catalog unavailable/i,
      ),
    )
    vi.restoreAllMocks()
  })

  it('shows Combat button only when an Environment is playing and disables it on stop', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))

    expect(
      screen.queryByRole('button', { name: /combat/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByRole('button', { name: /combat/i })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(
      screen.queryByRole('button', { name: /combat/i }),
    ).not.toBeInTheDocument()
  })

  it('toggles Combat mode on and off, updating aria-pressed and label', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    const combatButton = screen.getByRole('button', { name: /combat/i })
    expect(combatButton).toHaveAttribute('aria-pressed', 'false')
    expect(combatButton).toHaveTextContent('Combat off')

    fireEvent.click(combatButton)
    expect(screen.getByRole('button', { name: /combat/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /combat/i })).toHaveTextContent(
      'Combat on',
    )

    fireEvent.click(screen.getByRole('button', { name: /combat/i }))
    expect(screen.getByRole('button', { name: /combat/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('preserves Combat mode state when switching between Environments', () => {
    render(<App />)

    // Create two environments
    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Environment' }))

    const [play1, play2] = screen.getAllByRole('button', { name: 'Play' })

    // Play first environment and enable Combat mode
    fireEvent.click(play1)
    fireEvent.click(screen.getByRole('button', { name: /combat/i }))
    expect(screen.getByRole('button', { name: /combat/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // Switch to second environment — it should start in normal mode
    fireEvent.click(play2)
    expect(screen.getByRole('button', { name: /combat/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('searches the legacy catalog and composes playable Sounds', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'rain-1', name: 'Rainfall', tags: ['weather'], type: 'LOOP' },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'rain-1',
            name: 'Rainfall',
            fileName: 'rainfall',
            tags: ['weather'],
            source: { author: 'Legacy artist' },
            type: 'LOOP',
          }),
        ),
      )
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
  })
})
