/**
 * Lifetime Personal Memory Pipeline
 *
 * Provides durable, scalable memory storage and retrieval backed by Postgres.
 * Designed to handle 10M+ memories across 10-30 years without degradation.
 *
 * Architecture:
 *  - Postgres memories table (partitioned by year)
 *  - Async embedding pipeline (Postgres-backed queue, no BullMQ)
 *  - Three-tier retrieval: pinned facts → hybrid search → health aggregates
 *  - Memory consolidation (daily dedup of near-duplicates)
 */

import pg from 'pg'
import { emitLog } from './log-store.js'

const { Pool } = pg

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  id: string
  content: string
  source: string
  sourceId?: string | undefined
  type: string
  tags: string[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface HealthMetric {
  source: string
  metricType: string
  value: number
  unit: string
  activityType?: string
  recordedAt: string
  metadata?: Record<string, unknown>
  sourceId?: string
}

export interface ScoredMemory extends MemoryEntry {
  score: number
}

export interface HybridSearchOpts {
  limit?: number
  source?: string
  since?: Date
}

export type QueryType = 'fact' | 'health' | 'semantic'

export interface HealthTrendBucket {
  bucket: Date
  avgValue: number
  minValue: number
  maxValue: number
  samples: number
}

// ---------------------------------------------------------------------------
// Helper: map a Postgres row to a ScoredMemory
// ---------------------------------------------------------------------------

function mapMemoryRow(r: Record<string, unknown>): ScoredMemory {
  return {
    id: r.id as string,
    content: r.content as string,
    source: r.source as string,
    ...(r.source_id != null ? { sourceId: r.source_id as string } : {}),
    type: r.type as string,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
    score: parseFloat(r.score as string),
  }
}

// ---------------------------------------------------------------------------
// Query type detection
// ---------------------------------------------------------------------------

const FACT_PATTERNS = [
  /what.*my name/i,
  /who am i/i,
  /my name is/i,
  /what.*my company/i,
  /where.*i.*live/i,
  /my birthday/i,
  /when.*i.*born/i,
  /my occupation/i,
  /what.*i.*do for work/i,
  /my job/i,
  /my email/i,
  /my phone/i,
]

const HEALTH_PATTERNS = [
  /heart rate/i,
  /hrv/i,
  /steps/i,
  /sleep/i,
  /vo2 max/i,
  /weight/i,
  /calories/i,
  /fitness/i,
  /workout/i,
  /run(ning)?/i,
  /cycle|cycling|bike/i,
  /health.*trend/i,
  /health.*improve/i,
  /physical/i,
  /body weight/i,
]

export function detectQueryType(query: string): QueryType {
  if (FACT_PATTERNS.some((p) => p.test(query))) return 'fact'
  if (HEALTH_PATTERNS.some((p) => p.test(query))) return 'health'
  return 'semantic'
}

/** Map a natural-language fact query to a memory_facts key */
export function extractFactKey(query: string): string | null {
  const lower = query.toLowerCase()
  if (/name|who am i/.test(lower)) return 'user.name'
  if (/company|business|agency/.test(lower)) return 'user.company'
  if (/birthday|born/.test(lower)) return 'user.birthday'
  if (/location|live|city/.test(lower)) return 'user.location'
  if (/occupation|job|work/.test(lower)) return 'user.occupation'
  if (/email/.test(lower)) return 'user.email'
  return null
}

// ---------------------------------------------------------------------------
// FastEmbed wrapper (reuse the model Mastra already loaded)
// ---------------------------------------------------------------------------

let _embedModel: Awaited<ReturnType<typeof loadEmbedModel>> | null = null

async function loadEmbedModel() {
  // Import fastembed directly — it's already a transitive dep via @mastra/fastembed.
  // Reuse the same model file from the Mastra cache to avoid double-downloading.
  const { FlagEmbedding, EmbeddingModel } = await import('fastembed')
  const cacheDir = process.env['FASTEMBED_CACHE_DIR'] ?? '/data/fastembed-cache'
  const model = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    cacheDir,
  })
  return model
}

async function getEmbedModel() {
  if (!_embedModel) _embedModel = await loadEmbedModel()
  return _embedModel
}

/** Generate embeddings for a batch of texts. Returns Float32Array per text. */
async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const model = await getEmbedModel()
  const results: number[][] = []
  for await (const batch of model.embed(texts)) {
    for (const vec of batch) {
      results.push(Array.from(vec))
    }
  }
  return results
}

/** Generate a single embedding (for query-time use). */
async function embedQuery(text: string): Promise<number[]> {
  const model = await getEmbedModel()
  return Array.from(await model.queryEmbed(text))
}

// ---------------------------------------------------------------------------
// MemoryPipeline class
// ---------------------------------------------------------------------------

export class MemoryPipeline {
  private pool: pg.Pool
  private workerRunning = false

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5 })
  }

  async connect(): Promise<void> {
    // Verify connection and run migration if needed
    const client = await this.pool.connect()
    try {
      await client.query('SELECT 1')
      emitLog({
        level: 'info',
        agentId: 'memory-pipeline',
        message: 'Postgres connection established',
      })
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    this.workerRunning = false
    await this.pool.end()
  }

  // ── Schema migration ────────────────────────────────────────────────────────

  /** Run the SQL migration file. Safe to call multiple times (idempotent). */
  async runMigration(sql: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(sql)
      emitLog({ level: 'info', agentId: 'memory-pipeline', message: 'Schema migration applied' })
    } finally {
      client.release()
    }
  }

  // ── Memory upsert ───────────────────────────────────────────────────────────

  /** Insert or update a memory entry. Queues an embedding job automatically. */
  async upsertMemory(entry: MemoryEntry, priority: 1 | 5 | 10 = 5): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Upsert: if source+source_id already exists, update content/metadata
      await client.query(
        `INSERT INTO memories (id, content, source, source_id, type, tags, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id, created_at) DO UPDATE SET
           content    = EXCLUDED.content,
           metadata   = EXCLUDED.metadata,
           updated_at = EXCLUDED.updated_at,
           embedding  = NULL,  -- re-embed on content change
           embedding_at = NULL`,
        [
          entry.id,
          entry.content,
          entry.source,
          entry.sourceId ?? null,
          entry.type,
          entry.tags,
          entry.metadata,
          entry.createdAt,
          entry.updatedAt,
        ],
      )

      // Queue embedding job (skip if already queued for this memory)
      await client.query(
        `INSERT INTO embedding_jobs (memory_id, priority)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [entry.id, priority],
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /** Insert a health metric. Idempotent via source+source_id UNIQUE constraint. */
  async upsertHealthMetric(metric: HealthMetric): Promise<void> {
    await this.pool.query(
      `INSERT INTO health_metrics (source, metric_type, value, unit, activity_type, recorded_at, metadata, source_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [
        metric.source,
        metric.metricType,
        metric.value,
        metric.unit,
        metric.activityType ?? null,
        metric.recordedAt,
        metric.metadata ?? {},
        metric.sourceId ?? null,
      ],
    )
  }

  // ── Pinned facts ────────────────────────────────────────────────────────────

  async getFact(key: string): Promise<string | null> {
    const { rows } = await this.pool.query('SELECT value FROM memory_facts WHERE key = $1', [key])
    return rows[0]?.value ?? null
  }

  async setFact(key: string, value: string, source = 'system'): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_facts (key, value, source, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()`,
      [key, value, source],
    )
  }

  async getAllFacts(): Promise<Record<string, string>> {
    const { rows } = await this.pool.query('SELECT key, value FROM memory_facts')
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]))
  }

  // ── Hybrid search ───────────────────────────────────────────────────────────

  /**
   * Three-tier hybrid search:
   * score = 0.5 * semantic_cosine + 0.3 * bm25_rank + 0.2 * time_decay
   *
   * Runs BM25 (tsvector GIN) and HNSW vector search in parallel via CTE,
   * FULL OUTER JOINs the results, applies time decay (half-life = 180 days),
   * returns top-N sorted by fused score.
   */
  async hybridSearch(query: string, opts: HybridSearchOpts = {}): Promise<ScoredMemory[]> {
    const limit = opts.limit ?? 20
    const embedding = await embedQuery(query)
    const vecStr = `[${embedding.join(',')}]`

    const sourceFilter = opts.source ? `AND m.source = '${opts.source.replace(/'/g, "''")}'` : ''

    const { rows } = await this.pool.query(
      `WITH
       fts_candidates AS (
         SELECT id, created_at,
                ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS bm25_rank
         FROM memories
         WHERE tsv @@ plainto_tsquery('english', $1) ${sourceFilter}
         ORDER BY bm25_rank DESC
         LIMIT 200
       ),
       vec_candidates AS (
         SELECT id, created_at,
                1 - (embedding <=> $2::vector) AS semantic_score
         FROM memories
         WHERE embedding IS NOT NULL ${sourceFilter}
         ORDER BY embedding <=> $2::vector
         LIMIT 200
       ),
       fused AS (
         SELECT
           COALESCE(f.id, v.id) AS id,
           COALESCE(f.created_at, v.created_at) AS created_at,
           COALESCE(f.bm25_rank, 0)       AS bm25_rank,
           COALESCE(v.semantic_score, 0)  AS semantic_score,
           EXP(
             -EXTRACT(EPOCH FROM (NOW() - COALESCE(f.created_at, v.created_at)))
             / 86400.0 / 180.0
           ) AS time_decay
         FROM fts_candidates f
         FULL OUTER JOIN vec_candidates v
           ON f.id = v.id AND f.created_at = v.created_at
       ),
       scored AS (
         SELECT id, created_at,
                (0.5 * semantic_score) + (0.3 * bm25_rank) + (0.2 * time_decay) AS score
         FROM fused
         ORDER BY score DESC
         LIMIT $3
       )
       SELECT m.id, m.content, m.source, m.source_id, m.type, m.tags, m.metadata,
              m.created_at, m.updated_at, s.score
       FROM scored s
       JOIN memories m ON m.id = s.id AND m.created_at = s.created_at
       ORDER BY s.score DESC`,
      [query, vecStr, limit],
    )

    return rows.map(mapMemoryRow)
  }

  /**
   * FTS-only search — no embedding generation. Used for Ollama (small context)
   * and as a fast fallback when the embedding model is not yet loaded.
   */
  async ollamaSearch(query: string, limit = 5): Promise<ScoredMemory[]> {
    const { rows } = await this.pool.query(
      `SELECT id, content, source, source_id, type, tags, metadata, created_at, updated_at,
              ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS score
       FROM memories
       WHERE tsv @@ plainto_tsquery('english', $1)
       ORDER BY score DESC, created_at DESC
       LIMIT $2`,
      [query, limit],
    )

    return rows.map(mapMemoryRow)
  }

  // ── Health trend queries ────────────────────────────────────────────────────

  /**
   * SQL aggregate for health trend queries.
   * "How has my heart rate improved over 20 years?" →
   *   metric='heart_rate', period='month', span=240
   */
  async healthTrendQuery(opts: {
    metric: string
    period: 'day' | 'week' | 'month' | 'year'
    span: number
    activityType?: string
  }): Promise<HealthTrendBucket[]> {
    const actFilter = opts.activityType
      ? `AND activity_type = '${opts.activityType.replace(/'/g, "''")}'`
      : ''

    const { rows } = await this.pool.query(
      `SELECT
         DATE_TRUNC($1, recorded_at)   AS bucket,
         AVG(value)                    AS avg_value,
         MIN(value)                    AS min_value,
         MAX(value)                    AS max_value,
         COUNT(*)                      AS samples
       FROM health_metrics
       WHERE metric_type = $2
         AND recorded_at >= NOW() - ($3 || ' ' || $1)::interval
         ${actFilter}
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [opts.period, opts.metric, opts.span],
    )

    return rows.map((r: Record<string, unknown>) => ({
      bucket: r.bucket as Date,
      avgValue: parseFloat(r.avg_value as string),
      minValue: parseFloat(r.min_value as string),
      maxValue: parseFloat(r.max_value as string),
      samples: parseInt(r.samples as string, 10),
    }))
  }

  /** Format a health trend result as a human-readable summary for LLM injection. */
  formatHealthTrend(trend: HealthTrendBucket[], metric: string, unit = ''): string {
    if (trend.length === 0) return `No ${metric} data found.`

    const first = trend[0]!
    const last = trend[trend.length - 1]!
    const delta = last.avgValue - first.avgValue
    const sign = delta >= 0 ? '+' : ''
    const span = `${first.bucket.toISOString().slice(0, 7)} → ${last.bucket.toISOString().slice(0, 7)}`

    const lines = [
      `--- ${metric} trend (${span}) ---`,
      `Overall change: ${sign}${delta.toFixed(1)} ${unit}`,
      `Latest avg: ${last.avgValue.toFixed(1)} ${unit} (min ${last.minValue.toFixed(1)}, max ${last.maxValue.toFixed(1)})`,
      `Earliest avg: ${first.avgValue.toFixed(1)} ${unit}`,
    ]

    // Show last 6 buckets as a mini-table
    if (trend.length > 1) {
      lines.push('Recent trend:')
      trend.slice(-6).forEach((b) => {
        lines.push(
          `  ${b.bucket.toISOString().slice(0, 10)}: ${b.avgValue.toFixed(1)} ${unit} (${b.samples} samples)`,
        )
      })
    }

    return lines.join('\n')
  }

  // ── Browse (cursor-based pagination) ────────────────────────────────────────

  /**
   * Browse memories with cursor-based pagination — avoids OFFSET Gather Merge.
   * cursor = ISO timestamp of the last seen created_at (exclusive upper bound).
   * Returns { rows, total, bySource, nextCursor } where nextCursor is null when exhausted.
   */
  async browseMemories(opts: {
    q?: string
    source?: string
    cursor?: string // created_at of last item (DESC order)
    limit?: number
  }): Promise<{
    results: MemoryEntry[]
    total: number
    bySource: Record<string, number>
    nextCursor: string | null
  }> {
    const limit = Math.min(opts.limit ?? 50, 200)
    const conditions: string[] = []
    const params: unknown[] = []
    let p = 1

    if (opts.q) {
      conditions.push(`tsv @@ plainto_tsquery('english', $${p++})`)
      params.push(opts.q)
    }
    if (opts.source) {
      conditions.push(`source = $${p++}`)
      params.push(opts.source)
    }
    if (opts.cursor) {
      conditions.push(`created_at < $${p++}`)
      params.push(opts.cursor)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Run count + bySource + rows in parallel
    const [countRes, srcRes, rowRes] = await Promise.all([
      this.pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM memories ${opts.q || opts.source ? `WHERE ${[...(opts.q ? [`tsv @@ plainto_tsquery('english', $1)`] : []), ...(opts.source ? [`source = $${opts.q ? 2 : 1}`] : [])].join(' AND ')}` : ''}`,
        [...(opts.q ? [opts.q] : []), ...(opts.source ? [opts.source] : [])],
      ),
      this.pool.query<{ source: string; n: string }>(
        'SELECT source, COUNT(*) AS n FROM memories GROUP BY source ORDER BY n DESC',
      ),
      this.pool.query<{
        id: string
        content: string
        source: string
        source_id: string | null
        type: string
        tags: string[]
        metadata: Record<string, unknown>
        created_at: string
        updated_at: string
      }>(
        `SELECT id, content, source, source_id, type, tags, metadata, created_at, updated_at
         FROM memories ${where}
         ORDER BY created_at DESC
         LIMIT $${p}`,
        [...params, limit + 1],
      ),
    ])

    const allRows = rowRes.rows
    const hasMore = allRows.length > limit
    const rows = hasMore ? allRows.slice(0, limit) : allRows
    const nextCursor = hasMore ? (rows[rows.length - 1]?.created_at ?? null) : null

    const total = parseInt(countRes.rows[0]?.n ?? '0', 10)
    const bySource = Object.fromEntries(srcRes.rows.map((r) => [r.source, parseInt(r.n, 10)]))

    return {
      results: rows.map((r) => ({
        id: r.id,
        content: r.content,
        source: r.source,
        ...(r.source_id != null ? { sourceId: r.source_id } : {}),
        type: r.type,
        tags: r.tags ?? [],
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        createdAt:
          typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
        updatedAt:
          typeof r.updated_at === 'string' ? r.updated_at : new Date(r.updated_at).toISOString(),
      })),
      total,
      bySource,
      nextCursor,
    }
  }

  // ── Delete single memory ────────────────────────────────────────────────────

  async deleteMemory(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM memories WHERE id = $1', [id])
    return (rowCount ?? 0) > 0
  }

  // ── Memory count helpers ────────────────────────────────────────────────────

  async countTotal(): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*) AS n FROM memories')
    return parseInt(rows[0]?.n ?? '0', 10)
  }

  async countPendingEmbeddings(): Promise<number> {
    const { rows } = await this.pool.query(
      "SELECT COUNT(*) AS n FROM embedding_jobs WHERE status = 'pending'",
    )
    return parseInt(rows[0]?.n ?? '0', 10)
  }

  async countBySource(): Promise<Record<string, number>> {
    const { rows } = await this.pool.query(
      'SELECT source, COUNT(*) AS n FROM memories GROUP BY source ORDER BY n DESC',
    )
    return Object.fromEntries(
      rows.map((r: { source: string; n: string }) => [r.source, parseInt(r.n, 10)]),
    )
  }

  // ── Embedding worker ────────────────────────────────────────────────────────

  /**
   * Start the background embedding worker.
   * Polls the embedding_jobs queue every 500ms, claims up to 10 jobs,
   * generates FastEmbed embeddings, writes vectors back to memories table.
   * Uses FOR UPDATE SKIP LOCKED — safe to run multiple instances in parallel.
   */
  startWorker(): void {
    if (this.workerRunning) return
    this.workerRunning = true
    void this._workerLoop()
    emitLog({
      level: 'info',
      agentId: 'memory-pipeline',
      message: 'Embedding worker started',
    })
  }

  private async _workerLoop(): Promise<void> {
    // Pre-load the embedding model before entering the hot loop
    try {
      await getEmbedModel()
      emitLog({ level: 'info', agentId: 'memory-pipeline', message: 'FastEmbed model loaded' })
    } catch (err) {
      emitLog({
        level: 'warn',
        agentId: 'memory-pipeline',
        message: `FastEmbed load failed: ${String(err)} — will retry`,
      })
    }

    while (this.workerRunning) {
      try {
        const client = await this.pool.connect()
        try {
          // Claim up to 10 pending jobs (FOR UPDATE SKIP LOCKED prevents double-claiming)
          const { rows: jobs } = await client.query<{
            id: string
            memory_id: string
          }>(
            `UPDATE embedding_jobs
             SET status = 'processing', claimed_at = NOW(), attempts = attempts + 1
             WHERE id IN (
               SELECT id FROM embedding_jobs
               WHERE status = 'pending' AND attempts < 3
               ORDER BY priority, id
               LIMIT 50
               FOR UPDATE SKIP LOCKED
             )
             RETURNING id, memory_id`,
          )

          if (jobs.length === 0) {
            client.release()
            await sleep(500)
            continue
          }

          const memoryIds = jobs.map((j) => j.memory_id)

          // Fetch content for claimed jobs
          const { rows: memories } = await client.query<{
            id: string
            content: string
          }>('SELECT id, content FROM memories WHERE id = ANY($1)', [memoryIds])

          if (memories.length === 0) {
            // Memory deleted before embedding — mark jobs done
            await client.query("UPDATE embedding_jobs SET status = 'done' WHERE id = ANY($1)", [
              jobs.map((j) => j.id),
            ])
            client.release()
            continue
          }

          // Generate embeddings in one batch call
          const embeddingArrays = await embedBatch(memories.map((m) => m.content))

          // Write embeddings back
          for (let i = 0; i < memories.length; i++) {
            const mem = memories[i]!
            const vec = embeddingArrays[i]
            if (!vec || vec.length === 0) continue

            await client.query(
              `UPDATE memories
               SET embedding = $1::vector, embedding_at = NOW()
               WHERE id = $2`,
              [`[${vec.join(',')}]`, mem.id],
            )
          }

          // Mark jobs done
          const doneJobIds = jobs
            .filter((j) => memories.some((m) => m.id === j.memory_id))
            .map((j) => j.id)

          if (doneJobIds.length > 0) {
            await client.query("UPDATE embedding_jobs SET status = 'done' WHERE id = ANY($1)", [
              doneJobIds,
            ])
          }

          // Mark jobs for missing memories as failed
          const failedJobIds = jobs
            .filter((j) => !memories.some((m) => m.id === j.memory_id))
            .map((j) => j.id)

          if (failedJobIds.length > 0) {
            await client.query(
              "UPDATE embedding_jobs SET status = 'failed', last_error = 'memory not found' WHERE id = ANY($1)",
              [failedJobIds],
            )
          }

          client.release()

          emitLog({
            level: 'info',
            agentId: 'memory-pipeline',
            message: `Embedded ${memories.length} memories`,
          })
        } catch (err) {
          client.release()
          emitLog({
            level: 'error',
            agentId: 'memory-pipeline',
            message: `Embedding batch failed: ${String(err)}`,
          })
          await sleep(2000)
        }
      } catch (err) {
        emitLog({
          level: 'error',
          agentId: 'memory-pipeline',
          message: `Worker error: ${String(err)}`,
        })
        await sleep(5000)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  async exportMemories(opts: {
    source?: string
    type?: string
    since?: string
    limit?: number
  }): Promise<MemoryEntry[]> {
    const conditions: string[] = []
    const params: unknown[] = []
    let p = 1

    if (opts.source) {
      conditions.push(`source = $${p++}`)
      params.push(opts.source)
    }
    if (opts.type) {
      conditions.push(`type = $${p++}`)
      params.push(opts.type)
    }
    if (opts.since) {
      conditions.push(`created_at >= $${p++}`)
      params.push(opts.since)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const limitClause = `LIMIT $${p}`
    params.push(opts.limit ?? 100_000)

    const { rows } = await this.pool.query<{
      id: string
      content: string
      source: string
      source_id: string | null
      type: string
      tags: string[]
      metadata: Record<string, unknown>
      created_at: string
      updated_at: string
    }>(
      `SELECT id, content, source, source_id, type, tags, metadata, created_at, updated_at
       FROM memories ${where} ORDER BY created_at DESC ${limitClause}`,
      params,
    )

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      source: r.source,
      ...(r.source_id != null ? { sourceId: r.source_id } : {}),
      type: r.type,
      tags: r.tags ?? [],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt:
        typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
      updatedAt:
        typeof r.updated_at === 'string' ? r.updated_at : new Date(r.updated_at).toISOString(),
    }))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let _pipeline: MemoryPipeline | null = null

export function getMemoryPipeline(): MemoryPipeline | null {
  return _pipeline
}

export function initMemoryPipeline(connectionString: string): MemoryPipeline {
  if (_pipeline) return _pipeline
  _pipeline = new MemoryPipeline(connectionString)
  return _pipeline
}
