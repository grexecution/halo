import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

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

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

function read(): { entries: MemoryEntry[] } {
  if (!existsSync(FILE)) return { entries: [] }
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')) as { entries: MemoryEntry[] }
  } catch {
    return { entries: [] }
  }
}

function write(store: { entries: MemoryEntry[] }) {
  ensureDir()
  writeFileSync(FILE, JSON.stringify(store, null, 2), 'utf-8')
}

export function searchMemories(opts: {
  query?: string
  source?: string
  type?: string
  limit?: number
  offset?: number
}): { results: MemoryEntry[]; total: number; stats: { bySource: Record<string, number> } } {
  const store = read()
  let entries = store.entries

  if (opts.query) {
    const q = opts.query.toLowerCase()
    entries = entries.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        Object.values(e.metadata).some((v) => String(v).toLowerCase().includes(q)),
    )
  }
  if (opts.source) entries = entries.filter((e) => e.source === opts.source)
  if (opts.type) entries = entries.filter((e) => e.type === opts.type)

  const total = entries.length
  const offset = opts.offset ?? 0
  const limit = opts.limit ?? 20

  const bySource: Record<string, number> = {}
  for (const e of store.entries) {
    bySource[e.source] = (bySource[e.source] ?? 0) + 1
  }

  return { results: entries.slice(offset, offset + limit), total, stats: { bySource } }
}

export function getRelevantMemories(query: string, topK = 5): MemoryEntry[] {
  const { results } = searchMemories({ query, limit: topK })
  return results
}

export function upsertMemory(entry: MemoryEntry): void {
  const store = read()
  const idx = store.entries.findIndex((e) => e.id === entry.id)
  if (idx >= 0) {
    store.entries[idx] = entry
  } else {
    store.entries.unshift(entry)
  }
  write(store)
}

export function deleteMemory(id: string): boolean {
  const store = read()
  const prev = store.entries.length
  store.entries = store.entries.filter((e) => e.id !== id)
  if (store.entries.length === prev) return false
  write(store)
  return true
}
