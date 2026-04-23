/**
 * F-202: Postgres FTS cross-session search
 * F-203: Procedural memory (skill linkage)
 *
 * Tests the FTSIndex interface and InMemoryFTS implementation (used in tests
 * and non-Postgres environments). PostgresFTS is the production adapter that
 * wraps pg's to_tsvector/to_tsquery — its interface is identical.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryFTS } from '../src/fts.js'
import type { FTSDocument } from '../src/fts.js'

function makeDoc(overrides: Partial<FTSDocument> = {}): FTSDocument {
  return {
    id: crypto.randomUUID(),
    content: 'The quick brown fox jumps over the lazy dog',
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('F-202: FTSIndex', () => {
  let fts: InMemoryFTS

  beforeEach(() => {
    fts = new InMemoryFTS()
  })

  it('indexes a document and returns it on search', async () => {
    await fts.index(makeDoc({ content: 'the quick brown fox' }))
    const results = await fts.search('fox')
    expect(results).toHaveLength(1)
    expect(results[0]!.content).toContain('fox')
  })

  it('search is case-insensitive', async () => {
    await fts.index(makeDoc({ content: 'Postgres full-text search is powerful' }))
    const results = await fts.search('POSTGRES')
    expect(results).toHaveLength(1)
  })

  it('matches partial words (prefix search)', async () => {
    await fts.index(makeDoc({ content: 'database migrations are important' }))
    const results = await fts.search('migrat')
    expect(results).toHaveLength(1)
  })

  it('returns empty array when no match', async () => {
    await fts.index(makeDoc({ content: 'completely unrelated content' }))
    const results = await fts.search('elephant')
    expect(results).toHaveLength(0)
  })

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 20; i++) {
      await fts.index(makeDoc({ content: `common keyword document number ${i}` }))
    }
    const results = await fts.search('common', { limit: 5 })
    expect(results).toHaveLength(5)
  })

  it('indexes multiple documents and returns all matching', async () => {
    await fts.index(makeDoc({ id: 'a', content: 'typescript is great for large codebases' }))
    await fts.index(makeDoc({ id: 'b', content: 'typescript and node work well together' }))
    await fts.index(makeDoc({ id: 'c', content: 'python is also a popular language' }))
    const results = await fts.search('typescript')
    expect(results).toHaveLength(2)
    const ids = results.map((r) => r.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })

  it('deletes a document so it no longer appears in search', async () => {
    const doc = makeDoc({ id: 'del-me', content: 'ephemeral data that should be removed' })
    await fts.index(doc)
    expect(await fts.search('ephemeral')).toHaveLength(1)
    await fts.delete('del-me')
    expect(await fts.search('ephemeral')).toHaveLength(0)
  })

  it('counts indexed documents', async () => {
    expect(await fts.count()).toBe(0)
    await fts.index(makeDoc())
    await fts.index(makeDoc())
    expect(await fts.count()).toBe(2)
  })

  it('clears all documents', async () => {
    await fts.index(makeDoc())
    await fts.index(makeDoc())
    await fts.clear()
    expect(await fts.count()).toBe(0)
  })
})

describe('F-203: Procedural memory (skill linkage)', () => {
  let fts: InMemoryFTS

  beforeEach(() => {
    fts = new InMemoryFTS()
  })

  it('indexes a skill document with skill metadata', async () => {
    await fts.index({
      id: 'skill-grep',
      content: 'Use grep -r to search for patterns in a codebase recursively.',
      metadata: { type: 'skill', agentId: 'agent-1', skillName: 'grep' },
      createdAt: new Date().toISOString(),
    })

    const results = await fts.search('grep', { filterMetadata: { type: 'skill' } })
    expect(results).toHaveLength(1)
    expect(results[0]!.metadata['type']).toBe('skill')
    expect(results[0]!.metadata['skillName']).toBe('grep')
  })

  it('filters by metadata when searching', async () => {
    await fts.index({
      id: 'msg-1',
      content: 'I searched using grep and found the error',
      metadata: { type: 'message' },
      createdAt: new Date().toISOString(),
    })
    await fts.index({
      id: 'skill-1',
      content: 'grep is useful for searching text in files',
      metadata: { type: 'skill' },
      createdAt: new Date().toISOString(),
    })

    const skillsOnly = await fts.search('grep', { filterMetadata: { type: 'skill' } })
    expect(skillsOnly).toHaveLength(1)
    expect(skillsOnly[0]!.id).toBe('skill-1')

    const all = await fts.search('grep')
    expect(all).toHaveLength(2)
  })

  it('links a session to a skill by indexing with session metadata', async () => {
    await fts.index({
      id: 'skill-deploy-1',
      content: 'To deploy, run docker compose up -d',
      metadata: { type: 'skill', sessionId: 'session-42', agentId: 'agent-1' },
      createdAt: new Date().toISOString(),
    })

    const results = await fts.search('deploy', {
      filterMetadata: { sessionId: 'session-42' },
    })
    expect(results).toHaveLength(1)
    expect(results[0]!.metadata['sessionId']).toBe('session-42')
  })
})
