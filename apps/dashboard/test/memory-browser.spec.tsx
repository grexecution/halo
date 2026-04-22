/**
 * F-014: Memory browser
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('shows empty results list initially', () => {
    render(<MemoryPage />)
    const list = screen.getByTestId('memory-results')
    expect(list.children.length).toBe(0)
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
