import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('introduces the Turbobard audio workspace', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Turbobard' })).toBeVisible()
    expect(screen.getByText(/cross-platform audio workspace/i)).toBeVisible()
  })

  it('reports that the workspace is ready', () => {
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Ready for the first listening session.',
    )
  })
})
