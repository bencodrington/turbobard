import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogPanel } from './CatalogPanel'
import type { Environment } from '../domain/playback'
import type { CatalogResult } from '../domain/catalog'

const results: CatalogResult[] = [
  {
    id: 'swamp',
    name: 'Swamp Travel',
    kind: 'pack',
    tags: ['pack', 'travel'],
    items: [
      {
        id: 'music',
        name: 'Swamp Music',
        kind: 'loop',
        tags: ['music'],
        source: { urls: ['music.mp3'] },
        volume: 0.4,
      },
      {
        id: 'frog',
        name: 'Frogs',
        kind: 'one-shot',
        tags: ['wet', 'bog'],
        variations: ['frog.mp3'],
      },
    ],
  },
  {
    id: 'frog',
    name: 'Frogs',
    kind: 'one-shot',
    tags: ['wet', 'bog'],
    variations: ['frog.mp3'],
    source: { author: 'Artist', urls: ['frog.mp3'] },
  },
  {
    id: 'rain',
    name: 'Rain',
    kind: 'loop',
    tags: ['weather'],
    source: { urls: ['rain.mp3'] },
  },
]

function Harness({ open = true }: { open?: boolean }) {
  const [environment, setEnvironment] = useState<Environment>({
    id: 'forest',
    name: 'Forest',
    volume: 1,
    combatMode: false,
    playing: false,
    icon: 'tree',
    iconColor: '#fff',
    sounds: [],
  })
  return (
    <CatalogPanel
      environment={environment}
      open={open}
      onClose={() => {}}
      query="swamp"
      onQueryChange={() => {}}
      filter="everything"
      onFilterChange={() => {}}
      results={results}
      loading={false}
      error={false}
      onRetry={() => {}}
      onSoundsChange={(sounds) => setEnvironment({ ...environment, sounds })}
    />
  )
}

describe('Catalog results', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the destination, tags and pack contents, and switches plus/minus for shared members', () => {
    render(<Harness />)
    expect(screen.getByRole('heading')).toHaveTextContent('Adding to Forest')
    expect(
      screen.getByText('Contains 2 sounds, including music.'),
    ).toBeVisible()
    expect(
      screen.getByRole('list', { name: 'Tags for Frogs' }),
    ).toHaveTextContent('wetbog')
    expect(screen.queryByText('Artist')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Ambiance' })).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Preview Swamp Travel' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Frogs to environment' }),
    )
    expect(
      screen.getByRole('button', { name: 'Remove Frogs from environment' }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Swamp Travel to environment' }),
    )
    expect(
      screen.getByRole('button', {
        name: 'Remove Swamp Travel from environment',
      }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove Swamp Travel from environment',
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Add Frogs to environment' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Add Swamp Travel to environment' }),
    ).toBeVisible()
  })

  it('resets the placement toggle when search reopens', () => {
    const { rerender } = render(<Harness />)
    const toggle = screen.getByRole('checkbox', { name: 'Add to combat' })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
    rerender(<Harness open={false} />)
    rerender(<Harness />)
    expect(toggle).not.toBeChecked()
  })

  it('selects the current sound search text on focus', () => {
    render(<Harness />)
    const search = screen.getByRole('textbox', {
      name: 'Search Sounds',
    }) as HTMLInputElement

    fireEvent.focus(search)

    expect(search.selectionStart).toBe(0)
    expect(search.selectionEnd).toBe('swamp'.length)
  })

  it('previews independently, stops on switching/closing/unmount and recovers from playback failure', async () => {
    const audios: Array<{
      play: ReturnType<typeof vi.fn>
      pause: ReturnType<typeof vi.fn>
      load: ReturnType<typeof vi.fn>
      removeAttribute: ReturnType<typeof vi.fn>
      addEventListener: ReturnType<typeof vi.fn>
    }> = []
    const createAudio = vi
      .spyOn(window, 'Audio')
      .mockImplementation(function () {
        const audio = {
          play: vi.fn(() => Promise.resolve()),
          pause: vi.fn(),
          load: vi.fn(),
          removeAttribute: vi.fn(),
          addEventListener: vi.fn(),
        }
        audios.push(audio)
        return audio as unknown as HTMLAudioElement
      } as unknown as typeof Audio)
    const { rerender, unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview Frogs' }))
    expect(createAudio).toHaveBeenLastCalledWith('frog.mp3')
    expect(
      screen.getByRole('button', { name: 'Stop preview of Frogs' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Preview Rain' }))
    expect(audios[0].pause).toHaveBeenCalledOnce()
    expect(createAudio).toHaveBeenLastCalledWith('rain.mp3')
    fireEvent.click(
      screen.getByRole('button', { name: 'Stop preview of Rain' }),
    )
    expect(audios[1].pause).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Preview Frogs' }))
    rerender(<Harness open={false} />)
    expect(audios[2].pause).toHaveBeenCalledOnce()
    rerender(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview Rain' }))
    const errorListener = audios[3].addEventListener.mock.calls.find(
      ([event]) => event === 'error',
    )?.[1] as () => void
    act(() => errorListener())
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Preview unavailable: Rain',
    )
    expect(screen.getByRole('button', { name: 'Preview Rain' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Preview Frogs' }))
    await waitFor(() => expect(audios[4].play).toHaveBeenCalledOnce())
    unmount()
    expect(audios[4].pause).toHaveBeenCalledOnce()
  })
})
