/**
 * F-015: Cron & Goals page — comprehensive tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CronGoalsPage from '../app/cron-goals/page.js'

const MOCK_JOBS = [
  {
    id: 'j1',
    name: 'daily-summary',
    schedule: '0 9 * * *',
    active: true,
    createdAt: new Date().toISOString(),
    runCount: 5,
  },
  {
    id: 'j2',
    name: 'weekly-report',
    schedule: '0 10 * * 1',
    active: false,
    createdAt: new Date().toISOString(),
    runCount: 2,
  },
]

const MOCK_GOALS = [
  {
    id: 'g1',
    title: 'Analyze Q4 revenue trends',
    priority: 9,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'g2',
    title: 'Draft investor email',
    priority: 5,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'g3',
    title: 'Review pull requests',
    priority: 3,
    status: 'done',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function setupFetch() {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/crons' && (!opts?.method || opts.method === 'GET'))
      return Promise.resolve({ ok: true, json: async () => ({ jobs: MOCK_JOBS }) } as Response)
    if (url === '/api/goals' && (!opts?.method || opts.method === 'GET'))
      return Promise.resolve({ ok: true, json: async () => ({ goals: MOCK_GOALS }) } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
}

beforeEach(setupFetch)

describe('F-015: Cron & Goals page', () => {
  it('renders goals tab as default', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => expect(screen.getByTestId('goals-section')).toBeDefined(), {
      timeout: 3000,
    })
  })

  it('shows goal titles in the goals list', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => screen.getByText('Analyze Q4 revenue trends'), { timeout: 3000 })
    expect(screen.getByText('Draft investor email')).toBeDefined()
  })

  it('shows goal status badge for running goal', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => screen.getByTestId('goal-status-g2'), { timeout: 3000 })
    expect(screen.getByTestId('goal-status-g2').textContent).toContain('running')
  })

  it('shows done status badge', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => screen.getByTestId('goal-status-g3'), { timeout: 3000 })
    expect(screen.getByTestId('goal-status-g3').textContent).toMatch(/done|complete/i)
  })

  it('shows pending status badge', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => screen.getByTestId('goal-status-g1'), { timeout: 3000 })
    expect(screen.getByTestId('goal-status-g1').textContent).toContain('pending')
  })

  it('renders cron jobs section on tab click', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => expect(screen.getByTestId('cron-section')).toBeDefined(), { timeout: 3000 })
  })

  it('shows cron job names', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => screen.getByText('daily-summary'), { timeout: 3000 })
    expect(screen.getByText('weekly-report')).toBeDefined()
  })

  it('shows cron schedule expression', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => screen.getByText('0 9 * * *'), { timeout: 3000 })
  })

  it('active job toggle reflects true state', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => screen.getByTestId('toggle-j1'), { timeout: 3000 })
    expect(screen.getByTestId('toggle-j1').getAttribute('aria-checked')).toBe('true')
  })

  it('inactive job toggle reflects false state', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => screen.getByTestId('toggle-j2'), { timeout: 3000 })
    expect(screen.getByTestId('toggle-j2').getAttribute('aria-checked')).toBe('false')
  })

  it('toggling active job to inactive updates aria-checked', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => screen.getByTestId('toggle-j1'), { timeout: 3000 })
    const toggle = screen.getByTestId('toggle-j1')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('empty state shown when no goals exist', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/goals')
        return Promise.resolve({ ok: true, json: async () => ({ goals: [] }) } as Response)
      if (url === '/api/crons')
        return Promise.resolve({ ok: true, json: async () => ({ jobs: [] }) } as Response)
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })
    render(<CronGoalsPage />)
    await waitFor(() => screen.getByTestId('goals-section'), { timeout: 3000 })
    expect(screen.queryByText('Analyze Q4 revenue trends')).toBeNull()
  })
})
