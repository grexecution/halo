/**
 * F-202: Full-Text Search layer
 * F-203: Procedural memory (skill linkage via metadata)
 *
 * FTSDocument — the unit stored and searched.
 * FTSIndex — interface implemented by both InMemoryFTS (tests/non-PG) and
 *            PostgresFTS (production).
 */

export interface FTSDocument {
  id: string
  content: string
  metadata: Record<string, string>
  createdAt: string
}

export interface FTSSearchOptions {
  limit?: number
  /** Filter: returned documents must have ALL of these key=value metadata pairs */
  filterMetadata?: Record<string, string>
}

export interface FTSIndex {
  index(doc: FTSDocument): Promise<void>
  search(query: string, opts?: FTSSearchOptions): Promise<FTSDocument[]>
  delete(id: string): Promise<void>
  count(): Promise<number>
  clear(): Promise<void>
}

// ---------------------------------------------------------------------------
// InMemoryFTS — used in tests and as a fallback when Postgres is unavailable
// ---------------------------------------------------------------------------

/**
 * In-memory FTS implementation backed by a simple includes() search.
 * Supports case-insensitive prefix matching and metadata filtering.
 * The interface is identical to PostgresFTS so callers are swappable.
 */
export class InMemoryFTS implements FTSIndex {
  private docs: Map<string, FTSDocument> = new Map()

  async index(doc: FTSDocument): Promise<void> {
    this.docs.set(doc.id, doc)
  }

  async search(query: string, opts: FTSSearchOptions = {}): Promise<FTSDocument[]> {
    const lower = query.toLowerCase()
    const limit = opts.limit ?? 100
    const filter = opts.filterMetadata

    let results = Array.from(this.docs.values()).filter((doc) => {
      // Full-text match: case-insensitive prefix/substring
      if (!doc.content.toLowerCase().includes(lower)) return false
      // Metadata filter: all key=value pairs must match
      if (filter) {
        for (const [k, v] of Object.entries(filter)) {
          if (doc.metadata[k] !== v) return false
        }
      }
      return true
    })

    // Stable sort by createdAt descending (newest first)
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return results.slice(0, limit)
  }

  async delete(id: string): Promise<void> {
    this.docs.delete(id)
  }

  async count(): Promise<number> {
    return this.docs.size
  }

  async clear(): Promise<void> {
    this.docs.clear()
  }
}

// ---------------------------------------------------------------------------
// PostgresFTS — production adapter (wraps pg to_tsvector/to_tsquery)
// ---------------------------------------------------------------------------

/**
 * PostgresFTS wraps a Drizzle/pg query executor to use native Postgres FTS.
 * Requires the `fts_documents` table with a `tsvector` column (see migration).
 *
 * This class is production-only; it is NOT imported in tests.
 */
export interface PGQueryFn {
  (sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

export class PostgresFTS implements FTSIndex {
  private query: PGQueryFn
  constructor(query: PGQueryFn) {
    this.query = query
  }

  async index(doc: FTSDocument): Promise<void> {
    await this.query(
      `INSERT INTO fts_documents (id, content, metadata, created_at, tsv)
       VALUES ($1, $2, $3::jsonb, $4::timestamptz, to_tsvector('english', $2))
       ON CONFLICT (id) DO UPDATE
         SET content = excluded.content,
             metadata = excluded.metadata,
             tsv = excluded.tsv`,
      [doc.id, doc.content, JSON.stringify(doc.metadata), doc.createdAt],
    )
  }

  async search(query: string, opts: FTSSearchOptions = {}): Promise<FTSDocument[]> {
    const limit = opts.limit ?? 100
    const filter = opts.filterMetadata

    // Build metadata filter clause
    let metaClause = ''
    const extraParams: unknown[] = []
    if (filter) {
      const clauses = Object.entries(filter).map(([k, v], i) => {
        extraParams.push(k, v)
        const pi = 4 + i * 2
        return `metadata->>$${pi} = $${pi + 1}`
      })
      if (clauses.length > 0) metaClause = `AND ${clauses.join(' AND ')}`
    }

    const sql = `
      SELECT id, content, metadata, created_at
      FROM fts_documents
      WHERE tsv @@ plainto_tsquery('english', $1)
        ${metaClause}
      ORDER BY ts_rank(tsv, plainto_tsquery('english', $1)) DESC, created_at DESC
      LIMIT $2`

    const result = await this.query(sql, [query, limit, ...extraParams])
    return result.rows.map((row) => ({
      id: row['id'] as string,
      content: row['content'] as string,
      metadata: (row['metadata'] as Record<string, string>) ?? {},
      createdAt: (row['created_at'] as Date).toISOString(),
    }))
  }

  async delete(id: string): Promise<void> {
    await this.query(`DELETE FROM fts_documents WHERE id = $1`, [id])
  }

  async count(): Promise<number> {
    const result = await this.query(`SELECT COUNT(*)::int AS n FROM fts_documents`, [])
    return (result.rows[0]?.['n'] as number) ?? 0
  }

  async clear(): Promise<void> {
    await this.query(`TRUNCATE fts_documents`, [])
  }
}
