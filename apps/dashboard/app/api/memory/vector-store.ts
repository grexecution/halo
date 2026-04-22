import { join } from 'node:path'
import { homedir } from 'node:os'
import type { MemoryEntry } from './store'
import { EMBEDDING_DIM, embed, zeroVector } from './embedder'

const DB_PATH = join(homedir(), '.open-greg', 'lancedb')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanceTable = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanceDB = any

let _db: LanceDB | null = null
let _table: LanceTable | null = null
let _tableInitPromise: Promise<LanceTable> | null = null

interface VecRecord {
  id: string
  vector: number[]
  content: string
  source: string
  sourceId: string
  type: string
  tags: string
  metadata: string
  createdAt: string
  updatedAt: string
}

function toVecRecord(entry: MemoryEntry, vector: number[]): VecRecord {
  return {
    id: entry.id,
    vector,
    content: entry.content,
    source: entry.source,
    sourceId: entry.sourceId ?? '',
    type: entry.type,
    tags: JSON.stringify(entry.tags),
    metadata: JSON.stringify(entry.metadata),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

function fromVecRecord(r: VecRecord): MemoryEntry {
  return {
    id: r.id,
    content: r.content,
    source: r.source as MemoryEntry['source'],
    sourceId: r.sourceId || undefined,
    type: r.type,
    tags: JSON.parse(r.tags || '[]') as string[],
    metadata: JSON.parse(r.metadata || '{}') as Record<string, string>,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

async function getDb(): Promise<LanceDB> {
  if (_db) return _db
  const lancedb = await import('@lancedb/lancedb')
  _db = await lancedb.connect(DB_PATH)
  return _db
}

async function getTable(): Promise<LanceTable> {
  if (_table) return _table
  if (_tableInitPromise) return _tableInitPromise

  _tableInitPromise = (async () => {
    const db = await getDb()
    const tableNames: string[] = await db.tableNames()

    if (tableNames.includes('memories')) {
      _table = await db.openTable('memories')
      return _table
    }

    // Create table with placeholder record to establish schema, then delete it
    const placeholder: VecRecord = {
      id: '__init__',
      vector: new Array(EMBEDDING_DIM).fill(0),
      content: '',
      source: 'manual',
      sourceId: '',
      type: '',
      tags: '[]',
      metadata: '{}',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    _table = await db.createTable('memories', [placeholder])
    await (_table as LanceTable).delete("id = '__init__'")
    return _table
  })()

  return _tableInitPromise
}

export async function vecUpsert(entry: MemoryEntry): Promise<void> {
  const table = await getTable()
  const vector = (await embed(entry.content)) ?? zeroVector()
  const record = toVecRecord(entry, vector)
  // Delete then add is the safest upsert pattern in LanceDB
  try {
    await (table as LanceTable).delete(`id = '${entry.id.replace(/'/g, "\\'")}'`)
  } catch {
    // ignore if not found
  }
  await (table as LanceTable).add([record])
}

export async function vecSearch(query: string, topK: number): Promise<MemoryEntry[]> {
  const table = await getTable()
  const queryVec = await embed(query)

  if (!queryVec) {
    // Embedder not ready — return empty so caller falls back to keyword search
    return []
  }

  try {
    const rows = (await (table as LanceTable).search(queryVec).limit(topK).toArray()) as VecRecord[]
    // Filter out zero-vector placeholder entries and schema init
    return rows.filter((r) => r.id !== '__init__' && r.content).map(fromVecRecord)
  } catch {
    return []
  }
}

export async function vecDelete(id: string): Promise<void> {
  try {
    const table = await getTable()
    await (table as LanceTable).delete(`id = '${id.replace(/'/g, "\\'")}'`)
  } catch {
    // ignore
  }
}

export async function vecBulkUpsert(entries: MemoryEntry[]): Promise<void> {
  if (entries.length === 0) return
  const table = await getTable()

  const records: VecRecord[] = await Promise.all(
    entries.map(async (entry) => {
      const vector = (await embed(entry.content)) ?? zeroVector()
      return toVecRecord(entry, vector)
    }),
  )

  // Delete all existing IDs in batch, then add
  const ids = records.map((r) => `'${r.id.replace(/'/g, "\\'")}'`).join(', ')
  try {
    await (table as LanceTable).delete(`id IN (${ids})`)
  } catch {
    // ignore
  }
  await (table as LanceTable).add(records)
}
