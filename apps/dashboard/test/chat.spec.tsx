/**
 * F-010: Chat page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatPage from '../app/chat/page.js'

const SESSION = {
  id: 's1',
  title: 'New Chat',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messageCount: 0,
}

function setupFetch() {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (url === '/api/chats' && opts?.method === 'POST')
      return Promise.resolve({ ok: true, json: async () => SESSION } as Response)
    if (url === '/api/chats')
      return Promise.resolve({ ok: true, json: async () => ({ sessions: [] }) } as Response)
    if (String(url).match(/\/api\/chats\/s1$/))
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...SESSION, messages: [] }),
      } as Response)
    if (url === '/api/models')
      return Promise.resolve({
        ok: true,
        json: async () => ({
          models: [
            { id: 'ollama/llama3.2:1b', name: 'Llama 3.2', provider: 'ollama', available: true },
          ],
        }),
      } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
}

beforeEach(() => {
  setupFetch()
  // jsdom doesn't implement scrollIntoView
  window.HTMLElement.prototype.scrollIntoView =
    vi.fn() as typeof window.HTMLElement.prototype.scrollIntoView
})

function clickNewChat() {
  // There are two "New Chat" buttons (sidebar + empty state). Click the sidebar one.
  fireEvent.click(screen.getAllByText('New Chat')[0]!)
}

describe('F-010: Chat page', () => {
  it('renders chat input and send button', async () => {
    render(<ChatPage />)
    clickNewChat()
    await waitFor(() => expect(screen.getByTestId('chat-input')).toBeDefined(), { timeout: 3000 })
    expect(screen.getByTestId('send-button')).toBeDefined()
  })

  it('send button is disabled when input is empty', async () => {
    render(<ChatPage />)
    clickNewChat()
    await waitFor(() => screen.getByTestId('send-button'), { timeout: 3000 })
    const btn = screen.getByTestId('send-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('send button becomes enabled when text is typed', async () => {
    render(<ChatPage />)
    clickNewChat()
    await waitFor(() => screen.getByTestId('chat-input'), { timeout: 3000 })
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'Hello' } })
    const btn = screen.getByTestId('send-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('shows empty message list initially', async () => {
    render(<ChatPage />)
    clickNewChat()
    await waitFor(() => screen.getByTestId('message-list'), { timeout: 3000 })
    expect(screen.queryAllByTestId('message-user').length).toBe(0)
    expect(screen.queryAllByTestId('message-assistant').length).toBe(0)
  })

  it('displays error message when API returns non-ok response (no crash)', async () => {
    // Simulate the API failing with an error JSON (no `message` field)
    global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/chats' && opts?.method === 'POST')
        return Promise.resolve({ ok: true, json: async () => SESSION } as Response)
      if (url === '/api/chats')
        return Promise.resolve({ ok: true, json: async () => ({ sessions: [] }) } as Response)
      if (String(url).match(/\/api\/chats\/s1$/))
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...SESSION, messages: [] }),
        } as Response)
      if (url === '/api/models')
        return Promise.resolve({
          ok: true,
          json: async () => ({ models: [] }),
        } as Response)
      if (String(url).match(/\/api\/chats\/s1\/messages/) && opts?.method === 'POST')
        return Promise.resolve({
          ok: false,
          status: 502,
          json: async () => ({ error: 'LLM call failed: connection refused' }),
        } as Response)
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    })

    render(<ChatPage />)
    clickNewChat()
    await waitFor(() => screen.getByTestId('chat-input'), { timeout: 3000 })

    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByTestId('send-button'))

    // Should show the user message and then an error message — no TypeError crash
    await waitFor(() => screen.getByTestId('message-user'), { timeout: 3000 })
    await waitFor(() => screen.getByTestId('message-assistant'), { timeout: 3000 })
    expect(screen.getByTestId('message-assistant').textContent).toContain('Error')
  })
})
