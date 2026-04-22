/**
 * F-012: Agents CRUD page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgentsPage from '../app/agents/page.js'

vi.stubGlobal('confirm', () => true)

const DEFAULT_AGENTS = [
  {
    handle: 'main',
    name: 'Main Agent',
    model: 'claude-sonnet-4-6',
    fallbackModels: [],
    systemPrompt: 'You are a helpful AI assistant.',
    tools: { shell: false, browser: false, filesystem: false, gui: false },
  },
]

function setupFetch(agents = DEFAULT_AGENTS) {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/models')
      return Promise.resolve({ ok: true, json: async () => ({ models: [] }) } as Response)
    if (url === '/api/agents' && !opts?.method)
      return Promise.resolve({ ok: true, json: async () => ({ agents }) } as Response)
    if (url === '/api/agents' && opts?.method === 'POST')
      return Promise.resolve({ ok: true, json: async () => ({ agent: {} }) } as Response)
    if (String(url).match(/\/api\/agents\/.+/) && opts?.method === 'PUT')
      return Promise.resolve({ ok: true, json: async () => ({ agent: {} }) } as Response)
    if (String(url).match(/\/api\/agents\/.+/) && opts?.method === 'DELETE')
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
}

beforeEach(() => {
  setupFetch()
})

describe('F-012: Agents CRUD page', () => {
  it('renders the agents list with a default agent', async () => {
    render(<AgentsPage />)
    await waitFor(() => expect(screen.getByTestId('agent-list')).toBeDefined(), { timeout: 3000 })
    expect(screen.getByTestId('agent-item-main')).toBeDefined()
  })

  it('opens the new agent form in a dialog', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    expect(screen.getByTestId('agent-form')).toBeDefined()
    expect(screen.getByTestId('handle-input')).toBeDefined()
    expect(screen.getByTestId('name-input')).toBeDefined()
  })

  it('save button is disabled when handle is empty', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('can create a new agent', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    fireEvent.change(screen.getByTestId('handle-input'), { target: { value: 'coder' } })
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Coder Agent' } })
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('agent-item-coder')).toBeDefined(), {
      timeout: 3000,
    })
  })

  it('can delete an agent', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-item-main'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('delete-main'))
    await waitFor(() => expect(screen.queryByTestId('agent-item-main')).toBeNull(), {
      timeout: 3000,
    })
  })
})
