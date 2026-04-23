/**
 * F-208: Token cost dashboard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import CostPage from '../app/cost/page.js'

const MOCK_STATS = {
  totalCostUsd: 0.12345,
  totalTokens: 75000,
  sessions: [
    {
      sessionId: 'sess-abc-123',
      agentId: 'greg',
      totalTokens: 50000,
      totalCostUsd: 0.1,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    },
    {
      sessionId: 'sess-xyz-456',
      agentId: 'greg',
      totalTokens: 25000,
      totalCostUsd: 0.02345,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    },
  ],
  tools: [
    { toolId: 'shell_exec', totalCalls: 12, totalTokens: 3000, totalCostUsd: 0.06 },
    { toolId: 'fs_read', totalCalls: 5, totalTokens: 1000, totalCostUsd: 0.02 },
  ],
  dailyTrend: [
    { date: '2026-04-22', totalCostUsd: 0.05, totalTokens: 30000 },
    { date: '2026-04-23', totalCostUsd: 0.07345, totalTokens: 45000 },
  ],
}

function setupFetch(data = MOCK_STATS) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => data,
  } as Response)
}

describe('F-208: Cost dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', async () => {
    setupFetch()
    render(<CostPage />)
    expect(screen.getByText('Token Cost Dashboard')).toBeDefined()
  })

  it('renders summary stat cards', async () => {
    setupFetch()
    render(<CostPage />)
    await waitFor(() => {
      const summary = screen.getByTestId('cost-summary')
      expect(summary).toBeDefined()
    })
  })

  it('displays total cost from API data', async () => {
    setupFetch()
    render(<CostPage />)
    await waitFor(() => {
      // $0.12345
      const costEl = screen.getByTestId('stat-total-cost')
      expect(costEl.textContent).toContain('$')
    })
  })

  it('displays total tokens from API data', async () => {
    setupFetch()
    render(<CostPage />)
    await waitFor(() => {
      const tokenEl = screen.getByTestId('stat-total-tokens')
      expect(tokenEl.textContent).toContain('75k')
    })
  })

  it('renders the daily trend chart', async () => {
    setupFetch()
    render(<CostPage />)
    await waitFor(() => {
      const chart = screen.getByTestId('cost-trend-chart')
      expect(chart).toBeDefined()
    })
  })

  it('renders the tool cost table with tool names', async () => {
    setupFetch()
    render(<CostPage />)
    await waitFor(() => {
      const table = screen.getByTestId('tool-cost-table')
      expect(table.textContent).toContain('shell_exec')
      expect(table.textContent).toContain('fs_read')
    })
  })

  it('renders the session cost table with agent names', async () => {
    setupFetch()
    render(<CostPage />)
    await waitFor(() => {
      const table = screen.getByTestId('session-cost-table')
      expect(table.textContent).toContain('greg')
    })
  })

  it('shows empty state when no tools tracked', async () => {
    setupFetch({ ...MOCK_STATS, tools: [], sessions: [] })
    render(<CostPage />)
    await waitFor(() => {
      const toolTable = screen.getByTestId('tool-cost-table')
      expect(toolTable.textContent).toContain('No tool cost data yet')
    })
  })

  it('shows empty state when no sessions tracked', async () => {
    setupFetch({ ...MOCK_STATS, tools: [], sessions: [], dailyTrend: [] })
    render(<CostPage />)
    await waitFor(() => {
      const sessionTable = screen.getByTestId('session-cost-table')
      expect(sessionTable.textContent).toContain('No session data yet')
    })
  })

  it('renders without crashing when API returns empty stats', async () => {
    setupFetch({
      sessions: [],
      tools: [],
      dailyTrend: [],
      totalCostUsd: 0,
      totalTokens: 0,
    })
    render(<CostPage />)
    expect(screen.getByText('Token Cost Dashboard')).toBeDefined()
  })
})
