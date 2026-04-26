/**
 * F-016: Logs viewer (now in Activity > System Logs tab)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ActivityPage from '../app/activity/page.js'

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

const MOCK_RUNS = [
  {
    id: 'r1',
    agentId: 'claw',
    chatId: null,
    goalId: null,
    trigger: 'chat',
    status: 'completed',
    input: 'Hello world',
    output: 'Hi there!',
    toolCalls: [],
    tokenCount: 150,
    costUsd: 0.0001,
    startedAt: '2026-04-22T08:00:00.000Z',
    finishedAt: '2026-04-22T08:00:05.000Z',
    durationMs: 5000,
    error: null,
  },
  {
    id: 'r2',
    agentId: 'planner',
    chatId: null,
    goalId: 'g1',
    trigger: 'goal',
    status: 'failed',
    input: 'Run daily report',
    output: null,
    toolCalls: [{ toolId: 'shell', args: { cmd: 'report.sh' } }],
    tokenCount: 0,
    costUsd: 0,
    startedAt: '2026-04-22T07:00:00.000Z',
    finishedAt: '2026-04-22T07:00:30.000Z',
    durationMs: 30000,
    error: 'shell: permission denied',
  },
]

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const u = String(url)
    if (u.startsWith('/api/logs')) {
      const urlObj = new URL(u, 'http://localhost')
      const levelFilter = urlObj.searchParams.get('level')
      const filtered = levelFilter ? MOCK_LOGS.filter((l) => l.level === levelFilter) : MOCK_LOGS
      return Promise.resolve({
        ok: true,
        json: async () => ({ logs: filtered }),
      } as Response)
    }
    if (u.startsWith('/api/runs')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          runs: MOCK_RUNS,
          stats: { total: 2, completed: 1, failed: 1, total_tokens: 150, total_cost: 0.0001 },
        }),
      } as Response)
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
})

describe('F-016: Activity page (Agent Runs + System Logs)', () => {
  it('renders Activity page heading', () => {
    render(<ActivityPage />)
    expect(screen.getByText('Activity')).toBeDefined()
  })

  it('shows Agent Runs and System Logs tabs', () => {
    render(<ActivityPage />)
    expect(screen.getByText('Agent Runs')).toBeDefined()
    expect(screen.getByText('System Logs')).toBeDefined()
  })

  it('defaults to Agent Runs tab', async () => {
    render(<ActivityPage />)
    await waitFor(
      () => {
        expect(screen.getByText('Total runs')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows stats banner with run counts', async () => {
    render(<ActivityPage />)
    await waitFor(
      () => {
        expect(screen.getByText('Total runs')).toBeDefined()
        expect(screen.getByText('Completed')).toBeDefined()
        expect(screen.getByText('Failed')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('renders run entries from API', async () => {
    render(<ActivityPage />)
    await waitFor(
      () => {
        expect(screen.getByText('Hello world')).toBeDefined()
        expect(screen.getByText('Run daily report')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows completed and failed status badges', async () => {
    render(<ActivityPage />)
    await waitFor(
      () => {
        expect(screen.getByText('completed')).toBeDefined()
        expect(screen.getByText('failed')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('switches to System Logs tab', async () => {
    render(<ActivityPage />)
    fireEvent.click(screen.getByText('System Logs'))
    await waitFor(
      () => {
        expect(screen.getByText('Refresh')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows log messages in System Logs tab', async () => {
    render(<ActivityPage />)
    fireEvent.click(screen.getByText('System Logs'))
    await waitFor(
      () => {
        expect(screen.getByText('Agent started')).toBeDefined()
        expect(screen.getByText('Filesystem read denied')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('shows auto-refresh toggle in System Logs tab', async () => {
    render(<ActivityPage />)
    fireEvent.click(screen.getByText('System Logs'))
    await waitFor(
      () => {
        expect(screen.getByText('Auto-refresh')).toBeDefined()
      },
      { timeout: 3000 },
    )
  })

  it('renders level badge for each log entry', async () => {
    render(<ActivityPage />)
    fireEvent.click(screen.getByText('System Logs'))
    await waitFor(
      () => {
        const infoBadges = screen.getAllByText('info')
        expect(infoBadges.length).toBeGreaterThan(0)
      },
      { timeout: 3000 },
    )
  })

  it('expands run detail when clicked', async () => {
    render(<ActivityPage />)
    await waitFor(() => expect(screen.getByText('Hello world')).toBeDefined(), { timeout: 3000 })
    fireEvent.click(screen.getByText('Hello world'))
    await waitFor(
      () => {
        expect(screen.getByText('Hi there!')).toBeDefined()
      },
      { timeout: 2000 },
    )
  })

  it('shows error in failed run detail', async () => {
    render(<ActivityPage />)
    await waitFor(() => expect(screen.getByText('Run daily report')).toBeDefined(), {
      timeout: 3000,
    })
    fireEvent.click(screen.getByText('Run daily report'))
    await waitFor(
      () => {
        expect(screen.getByText('shell: permission denied')).toBeDefined()
      },
      { timeout: 2000 },
    )
  })
})
