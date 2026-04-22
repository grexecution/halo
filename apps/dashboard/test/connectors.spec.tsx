/**
 * F-013: Connectors page — plugin marketplace
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ConnectorsPage from '../app/connectors/page.js'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ connected: [] }),
  } as unknown as Response)
})

describe('F-013: Connectors page', () => {
  it('renders the plugin marketplace heading', async () => {
    render(<ConnectorsPage />)
    expect(screen.getByText('Plugin Marketplace')).toBeDefined()
  })

  it('shows category sidebar', async () => {
    render(<ConnectorsPage />)
    expect(screen.getByText('Categories')).toBeDefined()
    expect(screen.getByText('All plugins')).toBeDefined()
  })

  it('shows Gmail plugin card', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('Gmail')).toBeDefined())
  })

  it('shows multiple plugin categories', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      expect(screen.getAllByText('Google Workspace').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Communication').length).toBeGreaterThan(0)
    })
  })

  it('shows Connect button for disconnected plugins', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      const connectBtns = screen.getAllByText('Connect')
      expect(connectBtns.length).toBeGreaterThan(0)
    })
  })
})
