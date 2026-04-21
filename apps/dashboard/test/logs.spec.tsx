/**
 * F-016: Logs viewer
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LogsPage from '../app/logs/page.js'

describe('F-016: Logs viewer', () => {
  it('renders the log table', () => {
    render(<LogsPage />)
    expect(screen.getByTestId('log-table')).toBeDefined()
  })

  it('shows filter controls', () => {
    render(<LogsPage />)
    expect(screen.getByTestId('log-filters')).toBeDefined()
    expect(screen.getByTestId('level-filter')).toBeDefined()
    expect(screen.getByTestId('agent-filter')).toBeDefined()
    expect(screen.getByTestId('tool-filter')).toBeDefined()
  })

  it('renders default log rows', () => {
    render(<LogsPage />)
    expect(screen.getByTestId('log-row-1')).toBeDefined()
    expect(screen.getByTestId('log-row-2')).toBeDefined()
  })

  it('filters by level', () => {
    render(<LogsPage />)
    const levelFilter = screen.getByTestId('level-filter') as HTMLSelectElement
    fireEvent.change(levelFilter, { target: { value: 'error' } })
    // Only error log should be visible
    expect(screen.queryByTestId('log-row-1')).toBeNull()
    expect(screen.getByTestId('log-row-2')).toBeDefined()
  })
})
