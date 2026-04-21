export type MemoryChannel = 'chat' | 'telegram' | 'discord' | 'slack' | 'email' | 'api'

export interface MemoryMetadata {
  agentId: string
  sessionId: string
  channel: MemoryChannel
  timestamp: string
  [key: string]: string | undefined
}

export interface MemoryEntry {
  id: string
  content: string
  score: number
  metadata: MemoryMetadata
}

export interface IndexInput {
  content: string
  agentId: string
  sessionId: string
  channel: MemoryChannel
  timestamp: string
}

export interface SearchOptions {
  agentId?: string | undefined
  topK?: number | undefined
}

interface MemoryClientOptions {
  baseUrl: string
  dryRun?: boolean | undefined
  apiKey?: string | undefined
}

export class MemoryClient {
  private baseUrl: string
  private dryRun: boolean
  private apiKey: string | undefined
  private store: MemoryEntry[] = []
  private idCounter = 0

  constructor(opts: MemoryClientOptions) {
    this.baseUrl = opts.baseUrl
    this.dryRun = opts.dryRun ?? false
    this.apiKey = opts.apiKey
  }

  async index(input: IndexInput): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `mem-${++this.idCounter}-${Date.now()}`,
      content: input.content,
      score: 1.0,
      metadata: {
        agentId: input.agentId,
        sessionId: input.sessionId,
        channel: input.channel,
        timestamp: input.timestamp,
      },
    }

    if (this.dryRun) {
      this.store.push(entry)
      return entry
    }

    const res = await fetch(`${this.baseUrl}/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: input.content }],
        user_id: input.agentId,
        metadata: entry.metadata,
      }),
    })
    if (!res.ok) throw new Error(`Memory index failed: ${res.status}`)
    const data = (await res.json()) as { id: string }
    return { ...entry, id: data.id }
  }

  async search(query: string, opts: SearchOptions = {}): Promise<MemoryEntry[]> {
    if (this.dryRun) {
      // Simple substring match for dry-run
      const results = this.store
        .filter((m) => !opts.agentId || m.metadata.agentId === opts.agentId)
        .filter((m) => m.content.toLowerCase().includes(query.toLowerCase()))
        .slice(0, opts.topK ?? 10)
      return results
    }

    const params = new URLSearchParams({ query })
    if (opts.agentId) params.set('user_id', opts.agentId)
    if (opts.topK) params.set('limit', String(opts.topK))

    const res = await fetch(`${this.baseUrl}/v1/memories/search?${params}`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
    })
    if (!res.ok) throw new Error(`Memory search failed: ${res.status}`)
    const data = (await res.json()) as {
      results: Array<{ id: string; memory: string; score: number; metadata: MemoryMetadata }>
    }
    return data.results.map((r) => ({
      id: r.id,
      content: r.memory,
      score: r.score,
      metadata: r.metadata,
    }))
  }

  buildSystemContext(memories: MemoryEntry[]): string {
    if (memories.length === 0) return ''
    const lines = memories.map((m) => `- ${m.content}`)
    return `Relevant memories:\n${lines.join('\n')}`
  }

  async exportAll(): Promise<MemoryEntry[]> {
    if (this.dryRun) return [...this.store]

    const res = await fetch(`${this.baseUrl}/v1/memories`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
    })
    if (!res.ok) throw new Error(`Memory export failed: ${res.status}`)
    const data = (await res.json()) as {
      results: Array<{ id: string; memory: string; score: number; metadata: MemoryMetadata }>
    }
    return data.results.map((r) => ({
      id: r.id,
      content: r.memory,
      score: r.score,
      metadata: r.metadata,
    }))
  }

  async importAll(entries: MemoryEntry[]): Promise<void> {
    if (this.dryRun) {
      for (const e of entries) {
        if (!this.store.find((m) => m.id === e.id)) {
          this.store.push(e)
        }
      }
      return
    }

    for (const entry of entries) {
      await this.index({
        content: entry.content,
        agentId: entry.metadata.agentId,
        sessionId: entry.metadata.sessionId,
        channel: entry.metadata.channel,
        timestamp: entry.metadata.timestamp,
      })
    }
  }
}
