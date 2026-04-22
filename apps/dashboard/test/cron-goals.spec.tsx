/**
 * F-015: Cron & Goals page
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
    runCount: 0,
  },
  {
    id: 'j2',
    name: 'weekly-report',
    schedule: '0 10 * * 1',
    active: false,
    createdAt: new Date().toISOString(),
    runCount: 0,
  },
]
const MOCK_GOALS = [
  {
    id: 'g1',
    title: 'Analyze Q4 revenue',
    priority: 8,
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
]

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/crons' && (!opts?.method || opts.method === 'GET'))
      return Promise.resolve({ ok: true, json: async () => ({ jobs: MOCK_JOBS }) } as Response)
    if (url === '/api/goals' && (!opts?.method || opts.method === 'GET'))
      return Promise.resolve({ ok: true, json: async () => ({ goals: MOCK_GOALS }) } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
})

describe('F-015: Cron & Goals page', () => {
  it('renders goals section (default tab)', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => expect(screen.getByTestId('goals-section')).toBeDefined(), {
      timeout: 3000,
    })
  })

  it('renders cron jobs section after clicking tab', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => expect(screen.getByTestId('cron-section')).toBeDefined(), { timeout: 3000 })
  })

  it('shows scheduled job names', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => expect(screen.getByText('daily-summary')).toBeDefined(), { timeout: 3000 })
  })

  it('can toggle a job between active and paused', async () => {
    render(<CronGoalsPage />)
    fireEvent.click(screen.getByText('Cron Jobs'))
    await waitFor(() => screen.getByTestId('toggle-j1'), { timeout: 3000 })
    const toggle = screen.getByTestId('toggle-j1')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('shows goal status badges', async () => {
    render(<CronGoalsPage />)
    await waitFor(() => screen.getByTestId('goal-status-g2'), { timeout: 3000 })
    expect(screen.getByTestId('goal-status-g2').textContent).toContain('running')
  })
})
