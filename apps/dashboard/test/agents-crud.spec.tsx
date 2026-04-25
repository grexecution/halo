/**
 * F-012: Agents CRUD page
 * Covers: list, empty state, badges, dialog open, validation,
 * create, edit pre-fill, delete with confirmation.
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
    tools: { shell: true, browser: true, filesystem: true, gui: false },
  },
]

const MODELS = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
  },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', modelId: 'gpt-4o' },
]

function setupFetch(agents = DEFAULT_AGENTS) {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/models')
      return Promise.resolve({ ok: true, json: async () => ({ models: MODELS }) } as Response)
    if (url === '/api/agents' && !opts?.method)
      return Promise.resolve({ ok: true, json: async () => ({ agents }) } as Response)
    if (url === '/api/agents' && opts?.method === 'POST') {
      const body = JSON.parse((opts.body as string) ?? '{}') as { handle?: string; name?: string }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          agent: {
            handle: body.handle ?? 'new',
            name: body.name ?? 'New Agent',
            model: 'claude-sonnet-4-6',
            fallbackModels: [],
            systemPrompt: '',
            tools: { shell: false, browser: false, filesystem: false, gui: false },
          },
        }),
      } as Response)
    }
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

  it('shows agent handle and name in the card', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-item-main'), { timeout: 3000 })
    const card = screen.getByTestId('agent-item-main')
    expect(card.textContent).toContain('@main')
    expect(card.textContent).toContain('Main Agent')
  })

  it('shows tool badges for enabled tools', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-item-main'), { timeout: 3000 })
    const card = screen.getByTestId('agent-item-main')
    expect(card.textContent).toContain('Terminal')
    expect(card.textContent).toContain('Web Browser')
  })

  it('shows empty state when no agents exist', async () => {
    setupFetch([])
    render(<AgentsPage />)
    await waitFor(() => expect(screen.queryByText(/no agents/i)).toBeTruthy(), { timeout: 3000 })
  })

  it('opens the new agent form dialog', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    expect(screen.getByTestId('agent-form')).toBeDefined()
    expect(screen.getByTestId('handle-input')).toBeDefined()
    expect(screen.getByTestId('name-input')).toBeDefined()
  })

  it('save button disabled when handle is empty', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('save button enabled once handle and name are filled', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    fireEvent.change(screen.getByTestId('handle-input'), { target: { value: 'researcher' } })
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Research Bot' } })
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('can create a new agent and see it in the list', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-list'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('new-agent-button'))
    fireEvent.change(screen.getByTestId('handle-input'), { target: { value: 'coder' } })
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Coder Agent' } })
    fireEvent.click(screen.getByTestId('save-agent-button'))
    await waitFor(() => expect(screen.getByTestId('agent-item-coder')).toBeDefined(), {
      timeout: 3000,
    })
  })

  it('edit button opens dialog pre-filled with agent handle', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-item-main'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('edit-main'))
    await waitFor(() => screen.getByTestId('agent-form'), { timeout: 3000 })
    const handleInput = screen.getByTestId('handle-input') as HTMLInputElement
    expect(handleInput.value).toBe('main')
  })

  it('delete button opens confirmation dialog', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-item-main'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('delete-main'))
    await waitFor(() => screen.getByTestId('confirm-delete-button'), { timeout: 3000 })
    expect(screen.getByTestId('confirm-delete-button')).toBeDefined()
  })

  it('can delete an agent after confirmation', async () => {
    render(<AgentsPage />)
    await waitFor(() => screen.getByTestId('agent-item-main'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('delete-main'))
    await waitFor(() => screen.getByTestId('confirm-delete-button'), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('confirm-delete-button'))
    await waitFor(() => expect(screen.queryByTestId('agent-item-main')).toBeNull(), {
      timeout: 3000,
    })
  })
})
