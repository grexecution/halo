import { getDb } from '../../lib/db'

export type MemorySource = 'workspace' | 'chat' | 'manual'

export interface MemoryEntry {
  id: string
  content: string
  source: MemorySource
  sourceId: string | undefined
  type: string
  tags: string[]
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
}

interface DbRow {
  id: string
  content: string
  source: string
  source_id: string | null
  type: string
  tags: string
  metadata: string
  created_at: string
  updated_at: string
}

function toEntry(r: DbRow): MemoryEntry {
  return {
    id: r.id,
    content: r.content,
    source: r.source as MemorySource,
    sourceId: r.source_id ?? undefined,
    type: r.type,
    tags: JSON.parse(r.tags || '[]') as string[],
    metadata: JSON.parse(r.metadata || '{}') as Record<string, string>,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function searchMemories(opts: {
  query?: string
  source?: string
  type?: string
  limit?: number
  offset?: number
}): Promise<{
  results: MemoryEntry[]
  total: number
  stats: { bySource: Record<string, number> }
}> {
  const db = getDb()
  const limit = opts.limit ?? 20
  const offset = opts.offset ?? 0

  const statsRows = db
    .prepare('SELECT source, COUNT(*) as cnt FROM memories GROUP BY source')
    .all() as Array<{ source: string; cnt: number }>
  const bySource: Record<string, number> = {}
  for (const r of statsRows) bySource[r.source] = r.cnt

  const conditions: string[] = []
  const args: unknown[] = []

  if (opts.query) {
    conditions.push('(content LIKE ? OR tags LIKE ?)')
    args.push(`%${opts.query}%`, `%${opts.query}%`)
  }
  if (opts.source) {
    conditions.push('source = ?')
    args.push(opts.source)
  }
  if (opts.type) {
    conditions.push('type = ?')
    args.push(opts.type)
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM memories ${where}`).get(...args) as { cnt: number }
  ).cnt
  const rows = db
    .prepare(`SELECT * FROM memories ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset) as DbRow[]

  return { results: rows.map(toEntry), total, stats: { bySource } }
}

export async function getRelevantMemories(query: string, topK = 5): Promise<MemoryEntry[]> {
  const db = getDb()
  const q = `%${query}%`
  const rows = db
    .prepare(
      'SELECT * FROM memories WHERE content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC LIMIT ?',
    )
    .all(q, q, topK) as DbRow[]
  return rows.map(toEntry)
}

export async function upsertMemory(entry: MemoryEntry): Promise<void> {
  const db = getDb()
  db.prepare(
    `
    INSERT INTO memories (id, content, source, source_id, type, tags, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      source = excluded.source,
      source_id = excluded.source_id,
      type = excluded.type,
      tags = excluded.tags,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `,
  ).run(
    entry.id,
    entry.content,
    entry.source,
    entry.sourceId ?? null,
    entry.type,
    JSON.stringify(entry.tags),
    JSON.stringify(entry.metadata),
    entry.createdAt,
    entry.updatedAt,
  )
}

export async function deleteMemory(id: string): Promise<boolean> {
  const db = getDb()
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id)
  return result.changes > 0
}
