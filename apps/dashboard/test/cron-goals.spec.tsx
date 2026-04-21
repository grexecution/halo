/**
 * F-015: Cron & Goals page
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CronGoalsPage from '../app/cron-goals/page.js'

describe('F-015: Cron & Goals page', () => {
  it('renders cron jobs section', () => {
    render(<CronGoalsPage />)
    expect(screen.getByTestId('cron-section')).toBeTruthy()
  })

  it('renders goals section', () => {
    render(<CronGoalsPage />)
    expect(screen.getByTestId('goals-section')).toBeTruthy()
  })

  it('shows scheduled job names', () => {
    render(<CronGoalsPage />)
    expect(screen.getByText('daily-summary')).toBeTruthy()
  })

  it('can toggle a job between active and paused', () => {
    render(<CronGoalsPage />)
    const toggleBtn = screen.getByTestId('toggle-j1')
    expect(toggleBtn.textContent).toContain('Active')
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toContain('Paused')
  })

  it('shows goal status badges', () => {
    render(<CronGoalsPage />)
    expect(screen.getByTestId('goal-status-g2').textContent).toBe('running')
  })
})
