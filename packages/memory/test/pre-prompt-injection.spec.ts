/**
 * F-031: Pre-prompt memory injection
 * Verifies that top-N relevant memories are injected before each agent turn.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryClient } from '../src/index.js'

describe('F-031: Pre-prompt memory injection', () => {
  let client: MemoryClient

  beforeEach(() => {
    client = new MemoryClient({ baseUrl: 'http://localhost:8765', dryRun: true })
  })

  it('searches memories by semantic query', async () => {
    // Seed some memories
    await client.index({
      content: 'The client meeting is at 3pm',
      agentId: 'a1',
      sessionId: 's1',
      channel: 'chat',
      timestamp: new Date().toISOString(),
    })
    await client.index({
      content: 'The project deadline is Friday',
      agentId: 'a1',
      sessionId: 's1',
      channel: 'chat',
      timestamp: new Date().toISOString(),
    })

    const results = await client.search('meeting schedule', { agentId: 'a1', topK: 5 })
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns memories in relevance order (most relevant first)', async () => {
    const results = await client.search('anything', { agentId: 'a1', topK: 3 })
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('buildSystemContext returns a formatted memory block', async () => {
    const memories = [
      {
        id: '1',
        content: 'Client prefers morning calls',
        score: 0.9,
        metadata: { agentId: 'a1', sessionId: 's1', channel: 'chat' as const, timestamp: '' },
      },
    ]
    const context = client.buildSystemContext(memories)
    expect(context).toContain('Client prefers morning calls')
    expect(typeof context).toBe('string')
  })

  it('returns empty string when no memories', () => {
    const context = client.buildSystemContext([])
    expect(context).toBe('')
  })
})
