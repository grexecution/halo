/**
 * F-033: Cross-source entity linking
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { EntityLinking } from '../src/index.js'

describe('F-033: Entity linking', () => {
  let el: EntityLinking

  beforeEach(() => {
    el = new EntityLinking()
  })

  it('inserts a new entity', () => {
    el.upsert({
      name: 'Acme Corp',
      type: 'company',
      sources: ['gmail'],
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-01T00:00:00Z',
    })
    expect(el.size).toBe(1)
  })

  it('merges sources when the same entity is upserted from a second source', () => {
    const ts = '2024-01-01T00:00:00Z'
    el.upsert({
      name: 'Acme Corp',
      type: 'company',
      sources: ['gmail'],
      firstSeen: ts,
      lastSeen: ts,
    })
    el.upsert({
      name: 'Acme Corp',
      type: 'company',
      sources: ['github'],
      firstSeen: ts,
      lastSeen: ts,
    })

    expect(el.size).toBe(1)
    const entities = el.find('Acme Corp')
    expect(entities[0]?.sources).toContain('gmail')
    expect(entities[0]?.sources).toContain('github')
  })

  it('entity matching is case-insensitive', () => {
    const ts = '2024-01-01T00:00:00Z'
    el.upsert({
      name: 'acme corp',
      type: 'company',
      sources: ['gmail'],
      firstSeen: ts,
      lastSeen: ts,
    })
    el.upsert({
      name: 'ACME CORP',
      type: 'company',
      sources: ['slack'],
      firstSeen: ts,
      lastSeen: ts,
    })

    expect(el.size).toBe(1)
  })

  it('updates lastSeen on subsequent upsert', () => {
    el.upsert({
      name: 'Bob',
      type: 'person',
      sources: ['telegram'],
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-01T00:00:00Z',
    })
    el.upsert({
      name: 'Bob',
      type: 'person',
      sources: ['discord'],
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-06-01T00:00:00Z',
    })

    const result = el.find('Bob')
    expect(result[0]?.lastSeen).toBe('2024-06-01T00:00:00Z')
  })

  it('does not deduplicate different entities', () => {
    const ts = '2024-01-01T00:00:00Z'
    el.upsert({ name: 'Alice', type: 'person', sources: ['gmail'], firstSeen: ts, lastSeen: ts })
    el.upsert({ name: 'Bob', type: 'person', sources: ['gmail'], firstSeen: ts, lastSeen: ts })

    expect(el.size).toBe(2)
  })

  it('find returns matching entities', () => {
    const ts = '2024-01-01T00:00:00Z'
    el.upsert({ name: 'Anthropic', type: 'company', sources: ['web'], firstSeen: ts, lastSeen: ts })
    el.upsert({ name: 'OpenAI', type: 'company', sources: ['web'], firstSeen: ts, lastSeen: ts })

    const hits = el.find('thro')
    expect(hits).toHaveLength(1)
    expect(hits[0]?.name).toBe('Anthropic')
  })

  it('all() returns every entity', () => {
    const ts = '2024-01-01T00:00:00Z'
    el.upsert({ name: 'X', type: 'company', sources: ['a'], firstSeen: ts, lastSeen: ts })
    el.upsert({ name: 'Y', type: 'company', sources: ['b'], firstSeen: ts, lastSeen: ts })
    expect(el.all()).toHaveLength(2)
  })
})
