/**
 * F-030: Automatic chat indexing
 * Verifies that messages are indexed into memory with proper metadata.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryClient } from '../src/index.js'

describe('F-030: Automatic chat indexing', () => {
  let client: MemoryClient

  beforeEach(() => {
    client = new MemoryClient({ baseUrl: 'http://localhost:8765', dryRun: true })
  })

  it('indexes a message with required metadata fields', async () => {
    const indexed = await client.index({
      content: 'Remember that the meeting is at 3pm',
      agentId: 'agent-1',
      sessionId: 'sess-1',
      channel: 'chat',
      timestamp: new Date().toISOString(),
    })
    expect(indexed).toBeDefined()
    expect(indexed.id).toBeDefined()
    expect(indexed.content).toBe('Remember that the meeting is at 3pm')
    expect(indexed.metadata.agentId).toBe('agent-1')
    expect(indexed.metadata.channel).toBe('chat')
  })

  it('indexes messages from different channels', async () => {
    const chatMsg = await client.index({
      content: 'Hello from chat',
      agentId: 'a1',
      sessionId: 's1',
      channel: 'chat',
      timestamp: new Date().toISOString(),
    })
    const telegramMsg = await client.index({
      content: 'Hello from Telegram',
      agentId: 'a1',
      sessionId: 's2',
      channel: 'telegram',
      timestamp: new Date().toISOString(),
    })
    expect(chatMsg.metadata.channel).toBe('chat')
    expect(telegramMsg.metadata.channel).toBe('telegram')
  })
})
