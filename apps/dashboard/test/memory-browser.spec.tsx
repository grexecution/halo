/**
 * F-014: Memory browser
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemoryPage from '../app/memory/page.js'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [], total: 0, stats: { bySource: {} } }),
  } as Response)
})

describe('F-014: Memory browser', () => {
  it('renders search input and button', () => {
    render(<MemoryPage />)
    expect(screen.getByTestId('memory-search-input')).toBeDefined()
    expect(screen.getByTestId('memory-search-button')).toBeDefined()
  })

  it('shows empty state after load with no results', async () => {
    render(<MemoryPage />)
    // Wait for initial fetch to complete — empty state replaces skeleton
    await waitFor(() => expect(screen.getByTestId('no-results')).toBeDefined())
  })

  it('updates query state when typing', () => {
    render(<MemoryPage />)
    const input = screen.getByTestId('memory-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test query' } })
    expect(input.value).toBe('test query')
  })

  it('has page heading', () => {
    render(<MemoryPage />)
    expect(screen.getByText('Memory')).toBeDefined()
  })
})
