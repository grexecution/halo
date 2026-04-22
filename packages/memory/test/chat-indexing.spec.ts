/**
 * F-030: Automatic chat indexing
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ChatIndexing, type MemoryMessage } from '../src/index.js'

function makeMsg(overrides: Partial<MemoryMessage> = {}): MemoryMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: 'hello world',
    timestamp: new Date().toISOString(),
    threadId: 'thread-1',
    ...overrides,
  }
}

describe('F-030: Chat indexing', () => {
  let idx: ChatIndexing

  beforeEach(() => {
    idx = new ChatIndexing()
  })

  it('indexes a message and increases size', () => {
    expect(idx.size).toBe(0)
    idx.index(makeMsg())
    expect(idx.size).toBe(1)
  })

  it('indexes a batch of messages', () => {
    idx.indexBatch([makeMsg(), makeMsg(), makeMsg()])
    expect(idx.size).toBe(3)
  })

  it('retrieves messages by threadId', () => {
    idx.index(makeMsg({ threadId: 'thread-A', content: 'msg A' }))
    idx.index(makeMsg({ threadId: 'thread-B', content: 'msg B' }))
    const result = idx.getThread('thread-A')
    expect(result).toHaveLength(1)
    expect(result[0]?.content).toBe('msg A')
  })

  it('returns thread messages sorted newest-first', () => {
    const t1 = new Date(2024, 0, 1).toISOString()
    const t2 = new Date(2024, 0, 2).toISOString()
    idx.index(makeMsg({ timestamp: t1, content: 'older', threadId: 'th' }))
    idx.index(makeMsg({ timestamp: t2, content: 'newer', threadId: 'th' }))
    const result = idx.getThread('th')
    expect(result[0]?.content).toBe('newer')
  })

  it('searches messages by keyword', () => {
    idx.indexBatch([
      makeMsg({ content: 'the quick brown fox' }),
      makeMsg({ content: 'the lazy dog' }),
      makeMsg({ content: 'something else entirely' }),
    ])
    const hits = idx.search('fox')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.content).toContain('fox')
  })

  it('search returns empty array when no match', () => {
    idx.index(makeMsg({ content: 'hello world' }))
    expect(idx.search('nomatch')).toHaveLength(0)
  })

  it('clear() empties the store', () => {
    idx.indexBatch([makeMsg(), makeMsg()])
    idx.clear()
    expect(idx.size).toBe(0)
  })
})
