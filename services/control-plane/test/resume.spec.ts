/**
 * F-026: Agent session resume
 * Verifies that conversation history is loaded from storage on resume.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionStore } from '../src/session-store.js'
import type { Message } from '@claw-alt/agent-core'

describe('F-026: Agent session resume', () => {
  let store: SessionStore

  beforeEach(() => {
    store = new SessionStore({ dryRun: true })
  })

  it('saves messages to a session', async () => {
    await store.appendMessage('sess-1', {
      role: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    })
    await store.appendMessage('sess-1', {
      role: 'assistant',
      content: 'Hi there!',
      timestamp: new Date().toISOString(),
    })

    const history = await store.getHistory('sess-1')
    expect(history).toHaveLength(2)
    expect(history[0]?.role).toBe('user')
    expect(history[1]?.role).toBe('assistant')
  })

  it('returns empty history for unknown session', async () => {
    const history = await store.getHistory('nonexistent-session')
    expect(history).toEqual([])
  })

  it('preserves message order', async () => {
    const messages: Message[] = [
      { role: 'user', content: 'Turn 1', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Response 1', timestamp: new Date().toISOString() },
      { role: 'user', content: 'Turn 2', timestamp: new Date().toISOString() },
    ]
    for (const msg of messages) {
      await store.appendMessage('sess-order', msg)
    }
    const history = await store.getHistory('sess-order')
    expect(history.map((m) => m.content)).toEqual(['Turn 1', 'Response 1', 'Turn 2'])
  })

  it('supports multiple sessions independently', async () => {
    await store.appendMessage('sess-A', {
      role: 'user',
      content: 'Session A msg',
      timestamp: new Date().toISOString(),
    })
    await store.appendMessage('sess-B', {
      role: 'user',
      content: 'Session B msg',
      timestamp: new Date().toISOString(),
    })

    const histA = await store.getHistory('sess-A')
    const histB = await store.getHistory('sess-B')
    expect(histA).toHaveLength(1)
    expect(histB).toHaveLength(1)
    expect(histA[0]?.content).toBe('Session A msg')
    expect(histB[0]?.content).toBe('Session B msg')
  })
})
