/**
 * F-016: Logs viewer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogsPage from '../app/logs/page.js'

const MOCK_LOGS = [
  {
    id: '1',
    timestamp: '2026-04-22T08:00:01.000Z',
    level: 'info',
    message: 'Agent started',
    agentId: 'claw',
  },
  {
    id: '2',
    timestamp: '2026-04-22T08:00:02.312Z',
    level: 'debug',
    message: 'Loading model',
    agentId: 'claw',
  },
  {
    id: '3',
    timestamp: '2026-04-22T08:00:03.555Z',
    level: 'info',
    message: 'Tool call: shell_exec',
    agentId: 'claw',
    toolId: 'shell_exec',
    durationMs: 120,
  },
  {
    id: '4',
    timestamp: '2026-04-22T08:00:05.100Z',
    level: 'info',
    message: 'Turn complete',
    agentId: 'claw',
    durationMs: 3200,
    tokenCount: 512,
  },
  {
    id: '5',
    timestamp: '2026-04-22T08:00:07.880Z',
    level: 'warn',
    message: 'Budget: 80% of daily limit used',
    agentId: 'claw',
  },
  {
    id: '6',
    timestamp: '2026-04-22T08:00:09.200Z',
    level: 'error',
    message: 'Filesystem read denied',
    agentId: 'planner',
    toolId: 'filesystem',
  },
]

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).startsWith('/api/logs')) {
      const urlObj = new URL(String(url), 'http://localhost')
      const levelFilter = urlObj.searchParams.get('level')
      const filtered = levelFilter ? MOCK_LOGS.filter((l) => l.level === levelFilter) : MOCK_LOGS
      return Promise.resolve({
        ok: true,
        json: async () => ({
          logs: filtered,
          agents: ['claw', 'planner'],
          tools: ['shell_exec', 'filesystem'],
        }),
      } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
})

describe('F-016: Logs viewer', () => {
  it('renders the log table after loading', async () => {
    render(<LogsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('log-table')).toBeDefined()
    })
  })

  it('shows filter controls', () => {
    render(<LogsPage />)
    expect(screen.getByTestId('log-filters')).toBeDefined()
    expect(screen.getByTestId('level-filter')).toBeDefined()
  })

  it('renders log rows from API', async () => {
    render(<LogsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('log-row-1')).toBeDefined()
      expect(screen.getByTestId('log-row-3')).toBeDefined()
    })
  })

  it('shows duration and token columns', async () => {
    render(<LogsPage />)
    await waitFor(() => {
      expect(screen.getByText('Duration')).toBeDefined()
      expect(screen.getByText('Tokens')).toBeDefined()
    })
  })

  it('filters by level — only error rows visible', async () => {
    render(<LogsPage />)
    await waitFor(() => expect(screen.getByTestId('log-row-1')).toBeDefined())

    const levelFilter = screen.getByTestId('level-filter') as HTMLSelectElement
    fireEvent.change(levelFilter, { target: { value: 'error' } })

    await waitFor(() => {
      // id=1 is info — should be gone
      expect(screen.queryByTestId('log-row-1')).toBeNull()
      // id=6 is error — should be visible
      expect(screen.getByTestId('log-row-6')).toBeDefined()
    })
  })
})
