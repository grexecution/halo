import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { vecUpsert, vecSearch, vecDelete, vecBulkUpsert } from './vector-store'
import { warmUpEmbedder } from './embedder'

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

const DIR = join(homedir(), '.open-greg')
const FILE = join(DIR, 'memories.json')
const MIGRATED_FLAG = join(DIR, 'memories-migrated.flag')

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

function readJson(): { entries: MemoryEntry[] } {
  if (!existsSync(FILE)) return { entries: [] }
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')) as { entries: MemoryEntry[] }
  } catch {
    return { entries: [] }
  }
}

function writeJson(store: { entries: MemoryEntry[] }) {
  ensureDir()
  writeFileSync(FILE, JSON.stringify(store, null, 2), 'utf-8')
}

// One-time migration: embed all existing JSON memories into LanceDB
async function maybeMigrate() {
  if (existsSync(MIGRATED_FLAG)) return
  const store = readJson()
  if (store.entries.length === 0) {
    ensureDir()
    writeFileSync(MIGRATED_FLAG, new Date().toISOString(), 'utf-8')
    return
  }
  try {
    await vecBulkUpsert(store.entries)
    ensureDir()
    writeFileSync(MIGRATED_FLAG, new Date().toISOString(), 'utf-8')
  } catch {
    // Migration failed — will retry next startup
  }
}

// Kick off migration + embedder warmup once at module load
warmUpEmbedder()
void maybeMigrate()

// ── Public API ────────────────────────────────────────────────────────────────

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
  const store = readJson()
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 20

  const bySource: Record<string, number> = {}
  for (const e of store.entries) {
    bySource[e.source] = (bySource[e.source] ?? 0) + 1
  }

  if (opts.query) {
    // Vector search for semantic retrieval
    let semanticResults = await vecSearch(opts.query, (opts.limit ?? 20) + offset)

    // Apply source/type filters on top of semantic results
    if (opts.source) semanticResults = semanticResults.filter((e) => e.source === opts.source)
    if (opts.type) semanticResults = semanticResults.filter((e) => e.type === opts.type)

    if (semanticResults.length > 0) {
      return {
        results: semanticResults.slice(offset, offset + limit),
        total: semanticResults.length,
        stats: { bySource },
      }
    }

    // Fallback to keyword search if vector search returns nothing
    let entries = store.entries.filter(
      (e) =>
        e.content.toLowerCase().includes(opts.query!.toLowerCase()) ||
        e.tags.some((t) => t.toLowerCase().includes(opts.query!.toLowerCase())),
    )
    if (opts.source) entries = entries.filter((e) => e.source === opts.source)
    if (opts.type) entries = entries.filter((e) => e.type === opts.type)
    return {
      results: entries.slice(offset, offset + limit),
      total: entries.length,
      stats: { bySource },
    }
  }

  // No query — list all with optional filters
  let entries = store.entries
  if (opts.source) entries = entries.filter((e) => e.source === opts.source)
  if (opts.type) entries = entries.filter((e) => e.type === opts.type)

  return {
    results: entries.slice(offset, offset + limit),
    total: entries.length,
    stats: { bySource },
  }
}

export async function getRelevantMemories(query: string, topK = 5): Promise<MemoryEntry[]> {
  const results = await vecSearch(query, topK)
  if (results.length > 0) return results

  // Fallback to keyword search
  const store = readJson()
  const q = query.toLowerCase()
  return store.entries
    .filter(
      (e) => e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)),
    )
    .slice(0, topK)
}

export async function upsertMemory(entry: MemoryEntry): Promise<void> {
  // Write to JSON first (synchronous, always succeeds)
  const store = readJson()
  const idx = store.entries.findIndex((e) => e.id === entry.id)
  if (idx >= 0) {
    store.entries[idx] = entry
  } else {
    store.entries.unshift(entry)
  }
  writeJson(store)

  // Then embed + write to LanceDB (best-effort)
  void vecUpsert(entry)
}

export async function deleteMemory(id: string): Promise<boolean> {
  const store = readJson()
  const prev = store.entries.length
  store.entries = store.entries.filter((e) => e.id !== id)
  if (store.entries.length === prev) return false
  writeJson(store)
  void vecDelete(id)
  return true
}
