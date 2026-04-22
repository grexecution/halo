/**
 * F-018: Settings page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsPage from '../app/settings/page.js'

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/settings')
      return Promise.resolve({
        ok: true,
        json: async () => ({
          llm: { primary: '', models: [] },
          vision: { provider: 'local', model: 'paddleocr' },
          stt: { provider: 'local', model: 'parakeet' },
          tts: { provider: 'local', model: 'piper', voice: '' },
          permissions: {
            sudoEnabled: false,
            urlWhitelistMode: false,
            allowedUrls: [],
            blockedUrls: [],
            toolsEnabled: { shell: false, browser: true, filesystem: false, gui: false },
          },
          telemetry: { enabled: false, otelEndpoint: '' },
        }),
      } as Response)
    if (url === '/api/models')
      return Promise.resolve({ ok: true, json: async () => ({ models: [] }) } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
})

function clickTab(name: string) {
  fireEvent.click(screen.getByText(name))
}

describe('F-018: Settings page', () => {
  it('renders permission toggles', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    expect(screen.getByTestId('sudo-toggle')).toBeDefined()
    expect(screen.getByTestId('url-whitelist-toggle')).toBeDefined()
  })

  it('sudo is OFF by default', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    const sudo = screen
      .getByTestId('sudo-toggle')
      .querySelector('button[role="switch"]') as HTMLButtonElement
    expect(sudo?.getAttribute('aria-checked')).toBe('false')
  })

  it('can toggle sudo on', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    const sudo = screen
      .getByTestId('sudo-toggle')
      .querySelector('button[role="switch"]') as HTMLButtonElement
    fireEvent.click(sudo)
    expect(sudo?.getAttribute('aria-checked')).toBe('true')
  })

  it('renders telemetry settings', () => {
    render(<SettingsPage />)
    clickTab('Telemetry')
    expect(screen.getByTestId('telemetry-toggle')).toBeDefined()
    expect(screen.getByTestId('otel-endpoint')).toBeDefined()
  })

  it('renders save button', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('save-settings-button')).toBeDefined()
  })
})
