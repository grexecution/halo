/**
 * F-013: Connectors page — models + plugins tabs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ConnectorsPage from '../app/connectors/page.js'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ connected: [] }),
  } as unknown as Response)
})

describe('F-013: Connectors page', () => {
  it('renders the top-level tab bar with AI Models and Plugins tabs', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      expect(screen.getAllByText('AI Models').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Plugins').length).toBeGreaterThan(0)
    })
  })

  it('defaults to the AI Models tab showing cloud providers', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Cloud Providers')).toBeDefined()
      // Anthropic and OpenAI are always in the cloud section
      expect(screen.getByText('Anthropic Claude')).toBeDefined()
      expect(screen.getByText('OpenAI')).toBeDefined()
    })
  })

  it('shows Add key / Configure buttons for model providers', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      // ModelCard renders "Add key" for api_key providers
      const addKeyBtns = screen.getAllByText('Add key')
      expect(addKeyBtns.length).toBeGreaterThan(0)
    })
  })

  it('shows Add custom server button on the Models tab', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Add custom server').length).toBeGreaterThan(0)
    })
  })

  it('switching to Plugins tab shows category sidebar and plugin cards', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('Plugins')).toBeDefined())

    fireEvent.click(screen.getByText('Plugins'))

    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeDefined()
      expect(screen.getByText('All plugins')).toBeDefined()
      expect(screen.getByText('Gmail')).toBeDefined()
    })
  })

  it('Plugins tab shows Connect buttons for disconnected plugins', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('Plugins')).toBeDefined())

    fireEvent.click(screen.getByText('Plugins'))

    await waitFor(() => {
      const connectBtns = screen.getAllByText('Connect')
      expect(connectBtns.length).toBeGreaterThan(0)
    })
  })
})
