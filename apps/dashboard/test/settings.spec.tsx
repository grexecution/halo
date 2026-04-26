/**
 * F-018: Settings page — comprehensive tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPage from '../app/settings/page.js'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/settings',
}))

const MOCK_SETTINGS = {
  llm: { primary: 'gpt-4o', models: [] },
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
}

function setupFetch(overrides?: Partial<typeof MOCK_SETTINGS>) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/settings')
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...MOCK_SETTINGS, ...overrides }),
      } as Response)
    if (url === '/api/models')
      return Promise.resolve({ ok: true, json: async () => [] } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
}

beforeEach(() => setupFetch())

function clickTab(name: string) {
  fireEvent.click(screen.getByText(name))
}

describe('F-018: Settings page', () => {
  it('renders tabs including Permissions and Telemetry', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Permissions')).toBeDefined()
    expect(screen.getByText('Privacy')).toBeDefined()
  })

  it('shows sudo toggle on Permissions tab', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    expect(screen.getByTestId('sudo-toggle')).toBeDefined()
  })

  it('sudo starts as OFF by default', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    const btn = screen
      .getByTestId('sudo-toggle')
      .querySelector('button[role="switch"]') as HTMLButtonElement
    expect(btn?.getAttribute('aria-checked')).toBe('false')
  })

  it('can toggle sudo on', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    const btn = screen
      .getByTestId('sudo-toggle')
      .querySelector('button[role="switch"]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(btn?.getAttribute('aria-checked')).toBe('true')
  })

  it('can toggle sudo back off after turning on', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    const btn = screen
      .getByTestId('sudo-toggle')
      .querySelector('button[role="switch"]') as HTMLButtonElement
    fireEvent.click(btn) // on
    fireEvent.click(btn) // off
    expect(btn?.getAttribute('aria-checked')).toBe('false')
  })

  it('shows url whitelist toggle', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    expect(screen.getByTestId('url-whitelist-toggle')).toBeDefined()
  })

  it('renders telemetry toggle', () => {
    render(<SettingsPage />)
    clickTab('Privacy')
    expect(screen.getByTestId('telemetry-toggle')).toBeDefined()
  })

  it('renders otel endpoint input field', () => {
    render(<SettingsPage />)
    clickTab('Privacy')
    expect(screen.getByTestId('otel-endpoint')).toBeDefined()
  })

  it('telemetry disabled by default', () => {
    render(<SettingsPage />)
    clickTab('Privacy')
    const btn = screen
      .getByTestId('telemetry-toggle')
      .querySelector('button[role="switch"]') as HTMLButtonElement
    expect(btn?.getAttribute('aria-checked')).toBe('false')
  })

  it('renders save settings button', () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    expect(screen.getByTestId('save-settings-button')).toBeDefined()
  })

  it('save button calls fetch with PUT/POST on click', async () => {
    render(<SettingsPage />)
    clickTab('Permissions')
    fireEvent.click(screen.getByTestId('save-settings-button'))
    await waitFor(
      () => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
        const saveCalls = calls.filter((args: unknown[]) => {
          const url = args[0] as string
          const opts = args[1] as RequestInit | undefined
          return (
            String(url).includes('/api/settings') &&
            (opts?.method === 'PUT' || opts?.method === 'POST')
          )
        })
        expect(saveCalls.length).toBeGreaterThan(0)
      },
      { timeout: 2000 },
    )
  })

  it('Models tab is present', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Models')).toBeDefined()
  })

  it('Models tab shows redirect to Connectors message', async () => {
    render(<SettingsPage />)
    clickTab('Models')
    await waitFor(() => expect(screen.getAllByText(/Connectors/i).length).toBeGreaterThan(0), {
      timeout: 2000,
    })
  })
})
