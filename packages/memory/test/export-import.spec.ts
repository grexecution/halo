/**
 * F-034: Memory export / import
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ChatIndexing, ConnectorIndexing, EntityLinking, ExportImport } from '../src/index.js'

describe('F-034: Memory export / import', () => {
  let chat: ChatIndexing
  let connectors: ConnectorIndexing
  let entities: EntityLinking
  let exporter: ExportImport

  beforeEach(() => {
    chat = new ChatIndexing()
    connectors = new ConnectorIndexing()
    entities = new EntityLinking()
    exporter = new ExportImport(chat, connectors, entities)
  })

  it('export returns version 1 snapshot', () => {
    const snap = exporter.export()
    expect(snap.version).toBe(1)
    expect(typeof snap.exportedAt).toBe('string')
    expect(Array.isArray(snap.messages)).toBe(true)
    expect(Array.isArray(snap.connectorDocs)).toBe(true)
    expect(Array.isArray(snap.entities)).toBe(true)
  })

  it('export captures indexed messages', () => {
    chat.index({ id: '1', role: 'user', content: 'test msg', timestamp: new Date().toISOString() })
    const snap = exporter.export()
    expect(snap.messages).toHaveLength(1)
    expect(snap.messages[0]?.content).toBe('test msg')
  })

  it('export captures connector documents', () => {
    connectors.index({
      id: 'd1',
      source: 'gmail',
      title: 'Email',
      content: 'body',
      fetchedAt: new Date().toISOString(),
    })
    const snap = exporter.export()
    expect(snap.connectorDocs).toHaveLength(1)
    expect(snap.connectorDocs[0]?.source).toBe('gmail')
  })

  it('export captures entities', () => {
    const ts = new Date().toISOString()
    entities.upsert({
      name: 'Acme',
      type: 'company',
      sources: ['gmail'],
      firstSeen: ts,
      lastSeen: ts,
    })
    const snap = exporter.export()
    expect(snap.entities).toHaveLength(1)
    expect(snap.entities[0]?.name).toBe('Acme')
  })

  it('import restores messages into a fresh store', () => {
    // Seed original
    chat.index({ id: 'm1', role: 'user', content: 'original', timestamp: new Date().toISOString() })
    const snap = exporter.export()

    // Create a new store and import
    const chat2 = new ChatIndexing()
    const conn2 = new ConnectorIndexing()
    const ent2 = new EntityLinking()
    const importer = new ExportImport(chat2, conn2, ent2)
    importer.import(snap)

    expect(chat2.size).toBe(1)
    const msgs = chat2.search('original')
    expect(msgs[0]?.content).toBe('original')
  })

  it('import is idempotent — re-importing same snapshot does not duplicate', () => {
    chat.index({ id: 'm1', role: 'user', content: 'once', timestamp: new Date().toISOString() })
    const snap = exporter.export()

    // Import twice into the same store
    exporter.import(snap)
    exporter.import(snap)

    // clear() is called on each import, so size should still be 1
    expect(chat.size).toBe(1)
  })

  it('exportedAt is a valid ISO date string', () => {
    const snap = exporter.export()
    const d = new Date(snap.exportedAt)
    expect(d.getTime()).not.toBeNaN()
  })
})
