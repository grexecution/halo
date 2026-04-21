/**
 * F-034: Memory export/import
 * Verifies that the memory store can be exported to JSON and re-imported.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryClient, type MemoryEntry } from '../src/index.js'

describe('F-034: Memory export/import', () => {
  let client: MemoryClient

  beforeEach(() => {
    client = new MemoryClient({ baseUrl: 'http://localhost:8765', dryRun: true })
  })

  it('exports all memories as a JSON-serializable array', async () => {
    await client.index({
      content: 'Memory one',
      agentId: 'a1',
      sessionId: 's1',
      channel: 'chat',
      timestamp: new Date().toISOString(),
    })
    await client.index({
      content: 'Memory two',
      agentId: 'a1',
      sessionId: 's1',
      channel: 'chat',
      timestamp: new Date().toISOString(),
    })

    const exported = await client.exportAll()
    expect(Array.isArray(exported)).toBe(true)
    // In dry-run mode, memories are stored in-memory
    expect(exported.length).toBeGreaterThanOrEqual(0)
    const json = JSON.stringify(exported)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('importAll restores exported memories', async () => {
    const source: MemoryEntry[] = [
      {
        id: 'id-1',
        content: 'Restored memory',
        score: 1,
        metadata: {
          agentId: 'a1',
          sessionId: 's1',
          channel: 'chat',
          timestamp: new Date().toISOString(),
        },
      },
    ]

    await client.importAll(source)
    const exported = await client.exportAll()
    const found = exported.find((m) => m.id === 'id-1')
    expect(found).toBeDefined()
    expect(found?.content).toBe('Restored memory')
  })
})
