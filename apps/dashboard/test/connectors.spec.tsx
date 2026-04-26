/**
 * F-013: Connectors page — AI Models / Plugins / MCPs / Skills tabs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ConnectorsPage from '../app/connectors/page.js'

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('/api/plugins'))
      return Promise.resolve({
        ok: true,
        json: async () => ({ connected: [] }),
      } as unknown as Response)
    if (String(url).includes('/api/mcps'))
      return Promise.resolve({ ok: true, json: async () => ({ mcps: [] }) } as unknown as Response)
    if (String(url).includes('/api/skills'))
      return Promise.resolve({
        ok: true,
        json: async () => ({ skills: [] }),
      } as unknown as Response)
    if (String(url).includes('/api/custom-plugins'))
      return Promise.resolve({
        ok: true,
        json: async () => ({ plugins: [] }),
      } as unknown as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response)
  })
})

describe('F-013: Connectors page', () => {
  it('renders four tabs: AI Models, Plugins, MCPs, Skills', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      expect(screen.getAllByText('AI Models').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Plugins').length).toBeGreaterThan(0)
      expect(screen.getAllByText('MCPs').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Skills').length).toBeGreaterThan(0)
    })
  })

  it('defaults to the AI Models tab showing cloud providers section', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      expect(screen.getByText('Cloud Providers')).toBeDefined()
      expect(screen.getByText('Anthropic Claude')).toBeDefined()
      expect(screen.getByText('OpenAI')).toBeDefined()
    })
  })

  it('Models tab shows Add key buttons for cloud providers', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => {
      const btns = screen.getAllByText('Add key')
      expect(btns.length).toBeGreaterThan(0)
    })
  })

  it('Plugins tab shows category sidebar and Google Workspace card', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('Plugins')).toBeDefined())
    fireEvent.click(screen.getByText('Plugins'))
    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeDefined()
      expect(screen.getByText('All plugins')).toBeDefined()
      expect(screen.getAllByText('Google Workspace').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Set up in chat').length).toBeGreaterThan(0)
    })
  })

  it('Plugins tab has a Custom button to create custom plugins', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('Plugins')).toBeDefined())
    fireEvent.click(screen.getByText('Plugins'))
    await waitFor(() => {
      expect(screen.getByText('Custom')).toBeDefined()
    })
  })

  it('MCPs tab shows MCP server catalog with category sidebar', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('MCPs')).toBeDefined())
    fireEvent.click(screen.getByText('MCPs'))
    await waitFor(() => {
      expect(screen.getByText('MCP Servers')).toBeDefined()
      expect(screen.getByText('All servers')).toBeDefined()
      // Official reference servers should be visible
      expect(screen.getByText('Filesystem')).toBeDefined()
      expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0)
    })
  })

  it('MCPs tab shows tool chips on server cards', async () => {
    render(<ConnectorsPage />)
    fireEvent.click(await screen.findByText('MCPs'))
    await waitFor(() => {
      // Filesystem MCP exposes read_file tool
      expect(screen.getByText('read_file')).toBeDefined()
    })
  })

  it('Skills tab shows built-in skills with category sidebar', async () => {
    render(<ConnectorsPage />)
    await waitFor(() => expect(screen.getByText('Skills')).toBeDefined())
    fireEvent.click(screen.getByText('Skills'))
    await waitFor(() => {
      expect(screen.getByText('All skills')).toBeDefined()
      expect(screen.getByText('Write Blog Post')).toBeDefined()
      expect(screen.getByText('Code Review')).toBeDefined()
    })
  })

  it('Skills tab has New skill button', async () => {
    render(<ConnectorsPage />)
    fireEvent.click(await screen.findByText('Skills'))
    await waitFor(() => {
      expect(screen.getByText('New skill')).toBeDefined()
    })
  })

  it('Skills tab shows built-in badge on default skills', async () => {
    render(<ConnectorsPage />)
    fireEvent.click(await screen.findByText('Skills'))
    await waitFor(() => {
      const badges = screen.getAllByText('built-in')
      expect(badges.length).toBeGreaterThan(0)
    })
  })
})
