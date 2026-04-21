/**
 * F-018: Settings page
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from '../app/settings/page.js'

describe('F-018: Settings page', () => {
  it('renders permission toggles', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('sudo-toggle')).toBeDefined()
    expect(screen.getByTestId('url-whitelist-toggle')).toBeDefined()
  })

  it('sudo is OFF by default', () => {
    render(<SettingsPage />)
    const sudo = screen.getByTestId('sudo-toggle') as HTMLInputElement
    expect(sudo.checked).toBe(false)
  })

  it('can toggle sudo on', () => {
    render(<SettingsPage />)
    const sudo = screen.getByTestId('sudo-toggle') as HTMLInputElement
    fireEvent.click(sudo)
    expect(sudo.checked).toBe(true)
  })

  it('renders telemetry settings', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('telemetry-toggle')).toBeDefined()
    expect(screen.getByTestId('otel-endpoint')).toBeDefined()
  })

  it('renders save button', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('save-settings-button')).toBeDefined()
  })
})
