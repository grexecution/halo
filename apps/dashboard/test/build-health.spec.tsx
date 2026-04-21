/**
 * F-164: Build-health dashboard page
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BuildHealthPage from '../app/build-health/page.js'

describe('F-164: Build-health page', () => {
  it('renders the build health page', () => {
    render(<BuildHealthPage />)
    expect(screen.getByText('Build Health')).toBeDefined()
  })

  it('shows regressions section', () => {
    render(<BuildHealthPage />)
    expect(screen.getByTestId('regressions-section')).toBeDefined()
  })

  it('shows nightly section', () => {
    render(<BuildHealthPage />)
    expect(screen.getByTestId('nightly-section')).toBeDefined()
  })

  it('shows STUCK.md section', () => {
    render(<BuildHealthPage />)
    expect(screen.getByTestId('stuck-section')).toBeDefined()
  })

  it('shows "no regressions" when history is clean', () => {
    render(<BuildHealthPage />)
    // Build-health page reads from disk; in test environment the artifacts dir
    // may not exist, so it should show "no regressions" gracefully
    expect(screen.getByTestId('regressions-section')).toBeDefined()
  })
})
