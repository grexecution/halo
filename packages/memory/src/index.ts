/**
 * @open-greg/memory
 *
 * Lightweight in-process memory adapter. In production the control-plane
 * uses @mastra/memory (LibSQL-backed). This package provides:
 *   - F-030: ChatIndexing — index messages so they can be retrieved later
 *   - F-031: PrePromptInjection — prepend relevant memories to a system prompt
 *   - F-032: ConnectorIndexing — index text pulled from external connectors
 *   - F-033: EntityLinking — cross-source entity resolution
 *   - F-034: ExportImport — serialize / deserialize the full memory store
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface MemoryMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  resourceId?: string | undefined
  threadId?: string | undefined
  metadata?: Record<string, string> | undefined
}

export interface MemoryEntity {
  id: string
  name: string
  type: string
  sources: string[]
  firstSeen: string
  lastSeen: string
}

// ---------------------------------------------------------------------------
// F-030: Chat indexing
// ---------------------------------------------------------------------------

export class ChatIndexing {
  private store: MemoryMessage[] = []

  /** Index a single message. */
  index(msg: MemoryMessage): void {
    this.store.push(msg)
  }

  /** Index multiple messages at once. */
  indexBatch(messages: MemoryMessage[]): void {
    for (const m of messages) this.index(m)
  }

  /** Retrieve messages for a given thread, newest-first. */
  getThread(threadId: string): MemoryMessage[] {
    return this.store
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /** Simple keyword search across all indexed messages. */
  search(query: string, limit = 10): MemoryMessage[] {
    const lower = query.toLowerCase()
    return this.store.filter((m) => m.content.toLowerCase().includes(lower)).slice(0, limit)
  }

  get size(): number {
    return this.store.length
  }

  clear(): void {
    this.store = []
  }
}

// ---------------------------------------------------------------------------
// F-031: Pre-prompt injection
// ---------------------------------------------------------------------------

export class PrePromptInjection {
  constructor(private indexing: ChatIndexing) {}

  /**
   * Return a string of relevant past messages to prepend to the system prompt.
   * In production this would be a semantic search; here it is keyword-based.
   */
  inject(currentMessage: string, maxMessages = 5): string {
    const hits = this.indexing.search(currentMessage, maxMessages)
    if (hits.length === 0) return ''
    const lines = hits.map((m) => `[${m.role} @ ${m.timestamp}]: ${m.content}`).join('\n')
    return `## Relevant context from memory\n${lines}\n`
  }
}

// ---------------------------------------------------------------------------
// F-032: Connector pull indexing
// ---------------------------------------------------------------------------

export interface ConnectorDocument {
  id: string
  source: string
  title: string
  content: string
  fetchedAt: string
  metadata?: Record<string, string> | undefined
}

export class ConnectorIndexing {
  private docs: ConnectorDocument[] = []

  /** Index a document pulled from an external connector. */
  index(doc: ConnectorDocument): void {
    this.docs.push(doc)
  }

  /** Index multiple documents at once. */
  indexBatch(docs: ConnectorDocument[]): void {
    for (const d of docs) this.index(d)
  }

  /** Search across indexed connector documents. */
  search(query: string, limit = 10): ConnectorDocument[] {
    const lower = query.toLowerCase()
    return this.docs
      .filter(
        (d) => d.content.toLowerCase().includes(lower) || d.title.toLowerCase().includes(lower),
      )
      .slice(0, limit)
  }

  /** Get all documents from a specific source. */
  bySource(source: string): ConnectorDocument[] {
    return this.docs.filter((d) => d.source === source)
  }

  get size(): number {
    return this.docs.length
  }
}

// ---------------------------------------------------------------------------
// F-033: Entity linking
// ---------------------------------------------------------------------------

export class EntityLinking {
  private entities: Map<string, MemoryEntity> = new Map()

  /**
   * Register or update an entity. If an entity with the same normalised name
   * already exists, its sources list is merged and lastSeen is updated.
   */
  upsert(entity: Omit<MemoryEntity, 'id'> & { id?: string | undefined }): MemoryEntity {
    const key = entity.name.toLowerCase()
    const existing = this.entities.get(key)
    if (existing) {
      const merged: MemoryEntity = {
        ...existing,
        sources: Array.from(new Set([...existing.sources, ...entity.sources])),
        lastSeen: entity.lastSeen,
      }
      this.entities.set(key, merged)
      return merged
    }
    const newEntity: MemoryEntity = {
      id: entity.id ?? crypto.randomUUID(),
      name: entity.name,
      type: entity.type,
      sources: entity.sources,
      firstSeen: entity.firstSeen,
      lastSeen: entity.lastSeen,
    }
    this.entities.set(key, newEntity)
    return newEntity
  }

  /** Find entities by name substring (case-insensitive). */
  find(name: string): MemoryEntity[] {
    const lower = name.toLowerCase()
    return Array.from(this.entities.values()).filter((e) => e.name.toLowerCase().includes(lower))
  }

  get size(): number {
    return this.entities.size
  }

  all(): MemoryEntity[] {
    return Array.from(this.entities.values())
  }
}

// ---------------------------------------------------------------------------
// F-034: Export / import
// ---------------------------------------------------------------------------

export interface MemoryExport {
  version: 1
  exportedAt: string
  messages: MemoryMessage[]
  connectorDocs: ConnectorDocument[]
  entities: MemoryEntity[]
}

export class ExportImport {
  constructor(
    private chatIndex: ChatIndexing,
    private connectorIndex: ConnectorIndexing,
    private entityLinking: EntityLinking,
  ) {}

  /** Serialize the full memory state to a plain JSON-serialisable object. */
  export(): MemoryExport {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      messages: (this.chatIndex as unknown as { store: MemoryMessage[] }).store.slice(),
      connectorDocs: (this.connectorIndex as unknown as { docs: ConnectorDocument[] }).docs.slice(),
      entities: this.entityLinking.all(),
    }
  }

  /** Restore memory state from a previously exported snapshot. Clears first. */
  import(snapshot: MemoryExport): void {
    this.chatIndex.clear()
    this.chatIndex.indexBatch(snapshot.messages)
    this.connectorIndex.indexBatch(snapshot.connectorDocs)
    for (const e of snapshot.entities) {
      this.entityLinking.upsert(e)
    }
  }
}
