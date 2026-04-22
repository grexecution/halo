/**
 * F-032: Connector pull indexing
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ConnectorIndexing, type ConnectorDocument } from '../src/index.js'

function makeDoc(overrides: Partial<ConnectorDocument> = {}): ConnectorDocument {
  return {
    id: crypto.randomUUID(),
    source: 'gmail',
    title: 'Test email',
    content: 'Hello from connector',
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('F-032: Connector pull indexing', () => {
  let idx: ConnectorIndexing

  beforeEach(() => {
    idx = new ConnectorIndexing()
  })

  it('indexes a document and increases size', () => {
    expect(idx.size).toBe(0)
    idx.index(makeDoc())
    expect(idx.size).toBe(1)
  })

  it('indexes a batch of documents', () => {
    idx.indexBatch([makeDoc(), makeDoc(), makeDoc()])
    expect(idx.size).toBe(3)
  })

  it('searches documents by content keyword', () => {
    idx.indexBatch([
      makeDoc({ content: 'quarterly revenue report', title: 'Q4 report' }),
      makeDoc({ content: 'lunch invitation', title: 'Lunch' }),
    ])
    const hits = idx.search('revenue')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.content).toContain('revenue')
  })

  it('searches documents by title keyword', () => {
    idx.index(makeDoc({ title: 'Important Invoice', content: 'please pay' }))
    idx.index(makeDoc({ title: 'Newsletter', content: 'subscribe today' }))
    const hits = idx.search('Invoice')
    expect(hits).toHaveLength(1)
  })

  it('returns empty array for no matches', () => {
    idx.index(makeDoc({ content: 'nothing relevant' }))
    expect(idx.search('xyzzy')).toHaveLength(0)
  })

  it('filters documents by source', () => {
    idx.index(makeDoc({ source: 'gmail', content: 'gmail doc' }))
    idx.index(makeDoc({ source: 'github', content: 'github doc' }))
    idx.index(makeDoc({ source: 'gmail', content: 'another gmail doc' }))
    const gmailDocs = idx.bySource('gmail')
    expect(gmailDocs).toHaveLength(2)
    for (const d of gmailDocs) expect(d.source).toBe('gmail')
  })

  it('respects the limit parameter in search', () => {
    idx.indexBatch(Array.from({ length: 20 }, (_, i) => makeDoc({ content: `match ${i}` })))
    const hits = idx.search('match', 5)
    expect(hits).toHaveLength(5)
  })
})
