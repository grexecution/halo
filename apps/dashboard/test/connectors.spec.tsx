/**
 * F-013: Connectors page
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConnectorsPage from '../app/connectors/page.js'

describe('F-013: Connectors page', () => {
  it('renders connector list', () => {
    render(<ConnectorsPage />)
    expect(screen.getByTestId('connector-list')).toBeDefined()
  })

  it('shows Gmail connector', () => {
    render(<ConnectorsPage />)
    expect(screen.getByTestId('connector-gmail')).toBeDefined()
  })

  it('can enable a connector', () => {
    render(<ConnectorsPage />)
    const toggleBtn = screen.getByTestId('toggle-gmail')
    fireEvent.click(toggleBtn)
    expect(toggleBtn.textContent).toBe('Enabled')
  })

  it('has Add Connector button', () => {
    render(<ConnectorsPage />)
    expect(screen.getByTestId('add-connector-button')).toBeDefined()
  })
})
