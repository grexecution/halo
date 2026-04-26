/**
 * F-014: Memory browser — tests (now in /you page, Memory tab)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import YouPage from '../app/you/page.js'

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

function makeMemoriesResponse(memories = MOCK_MEMORIES, total = memories.length) {
  return {
    ok: true,
    json: async () => ({
      results: memories,
      total,
      stats: { bySource: { chat: 1, calendar: 1, email: 1 } },
      nextCursor: null,
    }),
  } as unknown as Response
}

function makeProfileResponse() {
  return {
    ok: true,
    json: async () => ({
      about: '',
      preferences: '',
      goals: '',
      workContext: '',
      updatedAt: '',
    }),
  } as unknown as Response
}

function makeNotesResponse() {
  return {
    ok: true,
    json: async () => ({ notes: [] }),
  } as unknown as Response
}

function makeTimelineResponse() {
  return {
    ok: true,
    json: async () => ({ events: [], total: 0 }),
  } as unknown as Response
}

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const u = String(url)
    if (u.startsWith('/api/memories')) return Promise.resolve(makeMemoriesResponse())
    if (u.startsWith('/api/you/profile')) return Promise.resolve(makeProfileResponse())
    if (u.startsWith('/api/you/notes')) return Promise.resolve(makeNotesResponse())
    if (u.startsWith('/api/you/timeline')) return Promise.resolve(makeTimelineResponse())
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
})

describe('F-014: Memory browser (You > Memory tab)', () => {
  it('renders the You page with tab navigation', () => {
    render(<YouPage />)
    expect(screen.getByText('You')).toBeDefined()
    expect(screen.getByText('Profile')).toBeDefined()
    expect(screen.getByText('Timeline')).toBeDefined()
    expect(screen.getByText('Memory')).toBeDefined()
    expect(screen.getByText('Notes')).toBeDefined()
  })

  it('switches to Memory tab when clicked', async () => {
    render(<YouPage />)
    const memTab = screen.getByText('Memory')
    fireEvent.click(memTab)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search what Halo remembers…')).toBeDefined()
    })
  })

  it('renders memory search input in Memory tab', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Memory'))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search what Halo remembers…')).toBeDefined()
    })
  })

  it('loads and shows memory items after switching to Memory tab', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Memory'))
    await waitFor(
      () => {
        expect(
          screen.getByText('User prefers dark mode and uses VSCode as their primary editor.'),
        ).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows all three memory items', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Memory'))
    await waitFor(
      () => {
        expect(
          screen.getByText('User prefers dark mode and uses VSCode as their primary editor.'),
        ).toBeDefined()
        expect(screen.getByText('Weekly standup every Monday at 9am.')).toBeDefined()
        expect(screen.getByText('Subject: Q4 review — please send slides by Friday.')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows empty state when no memories', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const u = String(url)
      if (u.startsWith('/api/memories'))
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [], total: 0, stats: { bySource: {} } }),
        } as unknown as Response)
      if (u.startsWith('/api/you/profile')) return Promise.resolve(makeProfileResponse())
      if (u.startsWith('/api/you/notes')) return Promise.resolve(makeNotesResponse())
      if (u.startsWith('/api/you/timeline')) return Promise.resolve(makeTimelineResponse())
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })
    render(<YouPage />)
    fireEvent.click(screen.getByText('Memory'))
    await waitFor(() => expect(screen.getByText('No memories found')).toBeDefined(), {
      timeout: 3000,
    })
  })

  it('shows memory count when memories loaded', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Memory'))
    await waitFor(
      () => {
        expect(screen.getByText('3 memories stored')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('filters search input updates', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Memory'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search what Halo remembers…')).toBeDefined(),
    )
    const input = screen.getByPlaceholderText('Search what Halo remembers…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'standup' } })
    expect(input.value).toBe('standup')
  })

  it('Profile tab shows about/preferences/goals/work sections', async () => {
    render(<YouPage />)
    await waitFor(
      () => {
        expect(screen.getByText('About me')).toBeDefined()
        expect(screen.getByText('My preferences')).toBeDefined()
        expect(screen.getByText('My goals')).toBeDefined()
        expect(screen.getByText('Work context')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('Profile tab shows save button', async () => {
    render(<YouPage />)
    await waitFor(() => expect(screen.getByText('Save profile')).toBeDefined(), { timeout: 3000 })
  })

  it('Notes tab shows "New note" button', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Notes'))
    await waitFor(() => expect(screen.getByText('New note')).toBeDefined(), { timeout: 3000 })
  })

  it('Notes tab shows empty state when no notes', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Notes'))
    await waitFor(() => expect(screen.getByText('No notes yet')).toBeDefined(), { timeout: 3000 })
  })

  it('Timeline tab shows filter buttons', async () => {
    render(<YouPage />)
    fireEvent.click(screen.getByText('Timeline'))
    await waitFor(
      () => {
        expect(screen.getByText('All')).toBeDefined()
        expect(screen.getByText('Memories')).toBeDefined()
        expect(screen.getByText('Agent runs')).toBeDefined()
        expect(screen.getByText('Chats')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })
})
