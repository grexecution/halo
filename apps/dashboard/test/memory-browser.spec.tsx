/**
 * F-014: Memory browser — comprehensive tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemoryPage from '../app/memory/page.js'

const MOCK_MEMORIES = [
  {
    id: 'm1',
    content: 'User prefers dark mode and uses VSCode as their primary editor.',
    source: 'chat',
    type: 'fact' as const,
    createdAt: new Date('2024-01-10T10:00:00Z').toISOString(),
  },
  {
    id: 'm2',
    content: 'Weekly standup every Monday at 9am.',
    source: 'calendar',
    type: 'note' as const,
    createdAt: new Date('2024-01-12T09:00:00Z').toISOString(),
  },
  {
    id: 'm3',
    content: 'Subject: Q4 review — please send slides by Friday.',
    source: 'email',
    type: 'email' as const,
    createdAt: new Date('2024-01-15T14:30:00Z').toISOString(),
  },
]

function makeResponse(memories = MOCK_MEMORIES, total = memories.length) {
  return {
    ok: true,
    json: async () => ({
      results: memories,
      total,
      stats: { bySource: { chat: 1, calendar: 1, email: 1 } },
    }),
  } as unknown as Response
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(makeResponse())
})

describe('F-014: Memory browser', () => {
  it('renders search input and search button', () => {
    render(<MemoryPage />)
    expect(screen.getByTestId('memory-search-input')).toBeDefined()
    expect(screen.getByTestId('memory-search-button')).toBeDefined()
  })

  it('has Memory page heading', () => {
    render(<MemoryPage />)
    expect(screen.getByText('Memory')).toBeDefined()
  })

  it('shows empty state when no results', async () => {
    global.fetch = vi.fn().mockResolvedValue(makeResponse([], 0))
    render(<MemoryPage />)
    await waitFor(() => expect(screen.getByTestId('no-results')).toBeDefined(), { timeout: 3000 })
    expect(screen.getByText('No memories found')).toBeDefined()
  })

  it('renders memory cards after load', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-results'), { timeout: 3000 })
    expect(screen.getByTestId('memory-item-m1')).toBeDefined()
    expect(screen.getByTestId('memory-item-m2')).toBeDefined()
    expect(screen.getByTestId('memory-item-m3')).toBeDefined()
  })

  it('displays memory content text', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-results'), { timeout: 3000 })
    expect(
      screen.getByText('User prefers dark mode and uses VSCode as their primary editor.'),
    ).toBeDefined()
  })

  it('shows total stat card', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getByText('Total memories'), { timeout: 3000 })
    expect(screen.getByText('3')).toBeDefined()
  })

  it('shows source stat cards from bySource data', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getAllByText('chat'), { timeout: 3000 })
    expect(screen.getAllByText('chat').length).toBeGreaterThan(0)
  })

  it('updates input value when typing in search', () => {
    render(<MemoryPage />)
    const input = screen.getByTestId('memory-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'standup' } })
    expect(input.value).toBe('standup')
  })

  it('calls fetch with query param when clicking Search', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-results'), { timeout: 3000 })
    const input = screen.getByTestId('memory-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'dark mode' } })
    fireEvent.click(screen.getByTestId('memory-search-button'))
    await waitFor(
      () => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const lastUrl = (calls[calls.length - 1]?.[0] ?? '') as string
        expect(lastUrl).toContain('q=dark+mode')
      },
      { timeout: 2000 },
    )
  })

  it('shows delete button on each memory card', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-results'), { timeout: 3000 })
    expect(screen.getByTestId('delete-memory-m1')).toBeDefined()
    expect(screen.getByTestId('delete-memory-m2')).toBeDefined()
  })

  it('removes memory card from list on delete confirm', async () => {
    global.confirm = vi.fn().mockReturnValue(true)
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'DELETE')
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
      return Promise.resolve(makeResponse())
    })
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-item-m1'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('delete-memory-m1'))
    await waitFor(() => expect(screen.queryByTestId('memory-item-m1')).toBeNull(), {
      timeout: 2000,
    })
  })

  it('keeps card when delete is cancelled', async () => {
    global.confirm = vi.fn().mockReturnValue(false)
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-item-m1'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('delete-memory-m1'))
    await waitFor(() => expect(screen.getByTestId('memory-item-m1')).toBeDefined(), {
      timeout: 1000,
    })
  })

  it('shows load more button when more results exist', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: MOCK_MEMORIES,
        total: 50, // more than 3 returned
        stats: { bySource: { chat: 1 } },
      }),
    } as unknown as Response)
    render(<MemoryPage />)
    await waitFor(() => screen.getByText('Load more'), { timeout: 3000 })
    expect(screen.getByText('Load more')).toBeDefined()
  })

  it('shows empty state with filtering message when filters active and no results', async () => {
    render(<MemoryPage />)
    await waitFor(() => screen.getByTestId('memory-results'), { timeout: 3000 })
    // Apply a filter then mock empty results
    global.fetch = vi.fn().mockResolvedValue(makeResponse([], 0))
    const input = screen.getByTestId('memory-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.click(screen.getByTestId('memory-search-button'))
    await waitFor(() => screen.getByTestId('no-results'), { timeout: 3000 })
    expect(
      screen.getByText('No memories match your current filters. Try adjusting or clearing them.'),
    ).toBeDefined()
  })
})
