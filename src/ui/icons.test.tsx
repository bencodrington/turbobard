import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FontAwesomeIconView } from './icons'

describe('FontAwesomeIconView', () => {
  it('renders a real SVG for a free solid icon ID', () => {
    const { container } = render(<FontAwesomeIconView iconId="campfire" />)

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(
      container.querySelector('[data-icon="campfire"]'),
    ).toBeInTheDocument()
  })

  it('renders an explicit fallback and reports unavailable IDs in development', () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    render(<FontAwesomeIconView iconId="not-a-real-icon" />)

    expect(screen.getByText('✦')).toHaveAttribute(
      'data-icon',
      'not-a-real-icon',
    )
    expect(warning).toHaveBeenCalledWith(
      'Font Awesome icon is unavailable: not-a-real-icon',
    )
  })
})
