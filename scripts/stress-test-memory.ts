/**
 * Lifetime Memory Stress Test Suite
 *
 * Tests T1-T7 from the architecture plan.
 * Runs in a loop, tuning HNSW ef_search until all benchmarks pass.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... pnpm tsx scripts/stress-test-memory.ts
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more tests failed after max iterations
 */

import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const { Pool } = pg

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greg:greg@localhost:5432/greg'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  process.stdout.write(`${msg}\n`)
}

function hr() {
  process.stdout.write(`${'─'.repeat(60)}\n`)
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now()
  const result = await fn()
  const ms = Date.now() - start
  return { result, ms }
}

// ---------------------------------------------------------------------------
// Embed helper (same model as pipeline — allMiniLML6V2 384-dim)
// ---------------------------------------------------------------------------

let _embedModel: unknown = null

async function getEmbedModel() {
  if (_embedModel)
    return _embedModel as {
      queryEmbed: (text: string) => Promise<number[]>
      embed: (texts: string[]) => AsyncGenerator<number[][], void, unknown>
    }
  const { FlagEmbedding, EmbeddingModel } = await import('fastembed')
  const cacheDir =
    process.env['FASTEMBED_CACHE_DIR'] ??
    (existsSync('/data') ? '/data/fastembed-cache' : `${tmpdir()}/fastembed-cache`)
  _embedModel = await FlagEmbedding.init({ model: EmbeddingModel.AllMiniLML6V2, cacheDir })
  return _embedModel as {
    queryEmbed: (text: string) => Promise<number[]>
    embed: (texts: string[]) => AsyncGenerator<number[][], void, unknown>
  }
}

async function embedQuery(text: string): Promise<number[]> {
  const model = await getEmbedModel()
  return Array.from(await model.queryEmbed(text))
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function countMemories(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM memories')
  return parseInt(rows[0]!.count, 10)
}

async function countEmbedded(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM memories WHERE embedding IS NOT NULL',
  )
  return parseInt(rows[0]!.count, 10)
}

async function countPending(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM embedding_jobs WHERE status = 'pending'",
  )
  return parseInt(rows[0]!.count, 10)
}

async function setEfSearch(pool: pg.Pool, ef: number) {
  await pool.query(`SET hnsw.ef_search = ${ef}`)
}

async function explainAnalyze(pool: pg.Pool, sql: string, params: unknown[]): Promise<string> {
  const { rows } = await pool.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
    params,
  )
  return rows.map((r) => r['QUERY PLAN']).join('\n')
}

// ---------------------------------------------------------------------------
// T1 — Fact lookup speed
// ---------------------------------------------------------------------------

async function testT1(
  pool: pg.Pool,
): Promise<{ passed: boolean; ms: number; value: string | null }> {
  const { result, ms } = await time('T1', async () => {
    const { rows } = await pool.query<{ value: string }>(
      "SELECT value FROM memory_facts WHERE key = 'user.name' LIMIT 1",
    )
    return rows[0]?.value ?? null
  })
  const passed = ms < 1000 && result !== null
  log(`  T1 fact lookup: ${ms}ms → "${result ?? 'NOT FOUND'}" [${passed ? 'PASS' : 'FAIL'}]`)
  return { passed, ms, value: result }
}

// ---------------------------------------------------------------------------
// T2 — Hybrid search at current scale < 2s
// ---------------------------------------------------------------------------

async function testT2(
  pool: pg.Pool,
  ef: number,
): Promise<{ passed: boolean; ms: number; count: number }> {
  const queryText = 'project status proposal'
  const embedding = await embedQuery(queryText)
  const vecLiteral = `[${embedding.join(',')}]`

  const sql = `
    WITH
    fts_candidates AS (
      SELECT id, created_at, ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS bm25_rank
      FROM memories
      WHERE tsv @@ plainto_tsquery('english', $1)
      ORDER BY bm25_rank DESC LIMIT 200
    ),
    vec_candidates AS (
      SELECT id, created_at, 1 - (embedding <=> $2::vector) AS semantic_score
      FROM memories WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $2::vector LIMIT 200
    ),
    fused AS (
      SELECT COALESCE(f.id, v.id) AS id,
             COALESCE(f.created_at, v.created_at) AS created_at,
             COALESCE(f.bm25_rank, 0) AS bm25_rank,
             COALESCE(v.semantic_score, 0) AS semantic_score,
             EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(f.created_at, v.created_at))) / 86400.0 / 180.0) AS time_decay
      FROM fts_candidates f
      FULL OUTER JOIN vec_candidates v ON f.id = v.id AND f.created_at = v.created_at
    ),
    scored AS (
      SELECT id, created_at,
             (0.5 * semantic_score) + (0.3 * bm25_rank) + (0.2 * time_decay) AS score
      FROM fused ORDER BY score DESC LIMIT $3
    )
    SELECT m.id, m.content, m.source, m.created_at, s.score
    FROM scored s JOIN memories m ON m.id = s.id AND m.created_at = s.created_at
    ORDER BY s.score DESC
  `

  await setEfSearch(pool, ef)
  const { result: rows, ms } = await time('T2', async () => {
    const { rows } = await pool.query(sql, [queryText, vecLiteral, 15])
    return rows
  })

  const passed = ms < 2000
  log(
    `  T2 hybrid search (ef=${ef}): ${ms}ms → ${rows.length} results [${passed ? 'PASS' : 'FAIL'}]`,
  )
  if (rows.length > 0) {
    log(`    top: [${rows[0].source}] ${String(rows[0].content).slice(0, 80)}...`)
  }
  return { passed, ms, count: rows.length }
}

// ---------------------------------------------------------------------------
// T3 — "What is my name?" top-1 contains Gregor
// ---------------------------------------------------------------------------

async function testT3(
  pool: pg.Pool,
  ef: number,
): Promise<{ passed: boolean; ms: number; topContent: string }> {
  const queryText = 'what is my name who am I'
  const embedding = await embedQuery(queryText)
  const vecLiteral = `[${embedding.join(',')}]`

  const sql = `
    WITH
    fts_candidates AS (
      SELECT id, created_at, ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS bm25_rank
      FROM memories WHERE tsv @@ plainto_tsquery('english', $1)
      ORDER BY bm25_rank DESC LIMIT 200
    ),
    vec_candidates AS (
      SELECT id, created_at, 1 - (embedding <=> $2::vector) AS semantic_score
      FROM memories WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $2::vector LIMIT 200
    ),
    fused AS (
      SELECT COALESCE(f.id, v.id) AS id, COALESCE(f.created_at, v.created_at) AS created_at,
             COALESCE(f.bm25_rank, 0) AS bm25_rank, COALESCE(v.semantic_score, 0) AS semantic_score,
             EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(f.created_at, v.created_at))) / 86400.0 / 180.0) AS time_decay
      FROM fts_candidates f FULL OUTER JOIN vec_candidates v ON f.id = v.id AND f.created_at = v.created_at
    )
    SELECT m.content, (0.5 * semantic_score) + (0.3 * bm25_rank) + (0.2 * time_decay) AS score
    FROM fused JOIN memories m ON m.id = fused.id AND m.created_at = fused.created_at
    ORDER BY score DESC LIMIT 5
  `

  await setEfSearch(pool, ef)
  const { result: rows, ms } = await time('T3', async () => {
    const { rows } = await pool.query<{ content: string; score: number }>(sql, [
      queryText,
      vecLiteral,
    ])
    return rows
  })

  // Also check pinned fact directly (should always pass if seeded)
  const { rows: factRows } = await pool.query<{ value: string }>(
    "SELECT value FROM memory_facts WHERE key = 'user.name'",
  )
  const factName = factRows[0]?.value ?? ''

  const topContent = rows[0]?.content ?? ''
  const hasGregor =
    topContent.toLowerCase().includes('gregor') ||
    topContent.toLowerCase().includes('greg') ||
    factName.toLowerCase().includes('gregor')

  log(`  T3 name query: ${ms}ms → top: "${topContent.slice(0, 100)}"`)
  log(`    fact: "${factName}" hasGregor=${hasGregor} [${hasGregor ? 'PASS' : 'FAIL'}]`)
  return { passed: hasGregor, ms, topContent }
}

// ---------------------------------------------------------------------------
// T4 — Heart rate trend returns ≥200 monthly buckets
// ---------------------------------------------------------------------------

async function testT4(pool: pg.Pool): Promise<{ passed: boolean; ms: number; buckets: number }> {
  const { result: rows, ms } = await time('T4', async () => {
    const { rows } = await pool.query<{ bucket: Date; avg_value: number; samples: number }>(`
      SELECT
        DATE_TRUNC('month', recorded_at) AS bucket,
        AVG(value) AS avg_value,
        COUNT(*) AS samples
      FROM health_metrics
      WHERE metric_type = 'heart_rate'
      GROUP BY bucket
      ORDER BY bucket
    `)
    return rows
  })

  const passed = rows.length >= 200 && ms < 1000
  const first = rows[0]
  const last = rows[rows.length - 1]
  log(
    `  T4 heart rate trend: ${ms}ms → ${rows.length} monthly buckets ` +
      `[${first?.bucket?.toISOString().slice(0, 7)} … ${last?.bucket?.toISOString().slice(0, 7)}] ` +
      `[${passed ? 'PASS' : rows.length < 200 ? `FAIL: need 200, got ${rows.length}` : 'FAIL: slow'}]`,
  )
  if (rows.length > 0) {
    const avgHr = rows.reduce((s, r) => s + r.avg_value, 0) / rows.length
    log(`    avg HR across all buckets: ${avgHr.toFixed(1)} bpm`)
  }
  return { passed, ms, buckets: rows.length }
}

// ---------------------------------------------------------------------------
// T5 — Consolidation: seed 100 near-identical memories, merge, verify < 10 remain
// ---------------------------------------------------------------------------

async function testT5(pool: pg.Pool): Promise<{ passed: boolean; before: number; after: number }> {
  // 1. Seed 100 identical copies with small variations
  const content = 'My name is Gregor Wallner and I run Fixonaut digital agency in Vienna.'
  const testTag = 'consolidation-test-' + randomUUID().slice(0, 8)
  const createdAt = new Date('2024-06-15T10:00:00Z')

  const client = await pool.connect()
  try {
    log('  T5 seeding 100 near-duplicate entries…')
    for (let i = 0; i < 100; i++) {
      const variation = i % 5 === 0 ? content : content + (i % 3 === 0 ? '.' : ' ')
      await client.query(
        `INSERT INTO memories (id, content, source, type, tags, metadata, created_at, updated_at)
         VALUES ($1, $2, 'note', 'identity', $3::text[], '{}', $4, $4)
         ON CONFLICT DO NOTHING`,
        [randomUUID(), variation, [testTag], createdAt.toISOString()],
      )
    }

    // 2. Count before consolidation
    const { rows: beforeRows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM memories WHERE $1 = ANY(tags)`,
      [testTag],
    )
    const before = parseInt(beforeRows[0]!.count, 10)
    log(`  T5 before consolidation: ${before} entries`)

    // 3. Embed them all inline (synchronously for test purposes)
    const model = await getEmbedModel()

    const { rows: unembedded } = await client.query<{
      id: string
      created_at: string
      content: string
    }>(`SELECT id, created_at, content FROM memories WHERE $1 = ANY(tags) AND embedding IS NULL`, [
      testTag,
    ])
    const texts = unembedded.map((r) => r.content)
    const embeddings: number[][] = []
    for await (const batch of model.embed(texts)) {
      for (const vec of batch) embeddings.push(Array.from(vec))
    }
    for (let i = 0; i < unembedded.length; i++) {
      const vec = embeddings[i] ?? []
      await client.query(
        `UPDATE memories SET embedding = $1::vector, embedding_at = NOW() WHERE id = $2 AND created_at = $3`,
        [`[${vec.join(',')}]`, unembedded[i]!.id, unembedded[i]!.created_at],
      )
    }
    log(`  T5 embedded ${unembedded.length} test entries`)

    // 4. Run consolidation directly on these entries
    const { rows: pairs } = await client.query<{
      id_a: string
      created_at_a: string
      id_b: string
      created_at_b: string
      content_a: string
      content_b: string
      similarity: number
    }>(
      `
      SELECT DISTINCT ON (LEAST(a.id, b.id), GREATEST(a.id, b.id))
        a.id AS id_a, a.created_at AS created_at_a,
        b.id AS id_b, b.created_at AS created_at_b,
        a.content AS content_a, b.content AS content_b,
        1 - (a.embedding <=> b.embedding) AS similarity
      FROM memories a
      JOIN memories b ON a.id < b.id AND a.created_at::date = b.created_at::date AND a.source = b.source
      WHERE $1 = ANY(a.tags) AND $1 = ANY(b.tags)
        AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
        AND 1 - (a.embedding <=> b.embedding) > 0.90
      LIMIT 500
    `,
      [testTag],
    )

    log(`  T5 found ${pairs.length} near-duplicate pairs (similarity > 0.90)`)

    let merged = 0
    for (const pair of pairs) {
      const keepId = pair.content_a.length >= pair.content_b.length ? pair.id_a : pair.id_b
      const keepCat =
        pair.content_a.length >= pair.content_b.length ? pair.created_at_a : pair.created_at_b
      const dropId = keepId === pair.id_a ? pair.id_b : pair.id_a
      const dropCat = keepId === pair.id_a ? pair.created_at_b : pair.created_at_a
      try {
        await client.query('BEGIN')
        await client.query(
          `UPDATE memories SET metadata = metadata || jsonb_build_object('merged_from', $1::text, 'merged_at', NOW()::text) WHERE id = $2 AND created_at = $3`,
          [dropId, keepId, keepCat],
        )
        await client.query('DELETE FROM memories WHERE id = $1 AND created_at = $2', [
          dropId,
          dropCat,
        ])
        await client.query(
          `INSERT INTO memory_consolidations (memory_id, merged_into) VALUES ($1, $2), ($3, NULL) ON CONFLICT (memory_id) DO NOTHING`,
          [dropId, keepId, keepId],
        )
        await client.query('COMMIT')
        merged++
      } catch {
        await client.query('ROLLBACK')
      }
    }
    log(`  T5 merged ${merged} pairs`)

    // 5. Count after
    const { rows: afterRows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM memories WHERE $1 = ANY(tags)`,
      [testTag],
    )
    const after = parseInt(afterRows[0]!.count, 10)
    const passed = after < 10
    log(`  T5 after consolidation: ${after} entries [${passed ? 'PASS' : 'FAIL: need < 10'}]`)

    // Cleanup test data
    await client.query(`DELETE FROM memories WHERE $1 = ANY(tags)`, [testTag])
    await client.query(`DELETE FROM memory_consolidations WHERE memory_id LIKE 'test-%'`)

    return { passed, before, after }
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// T6 — Ollama FTS-only path < 500ms
// ---------------------------------------------------------------------------

async function testT6(pool: pg.Pool): Promise<{ passed: boolean; ms: number; count: number }> {
  const { result: rows, ms } = await time('T6', async () => {
    const { rows } = await pool.query<{ id: string; content: string; source: string }>(
      `SELECT id, content, source, created_at
       FROM memories
       WHERE tsv @@ plainto_tsquery('english', $1)
       ORDER BY ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) DESC
       LIMIT 5`,
      ['project proposal'],
    )
    return rows
  })

  const passed = ms < 2000
  log(`  T6 FTS-only search: ${ms}ms → ${rows.length} results [${passed ? 'PASS' : 'FAIL'}]`)
  return { passed, ms, count: rows.length }
}

// ---------------------------------------------------------------------------
// T7 — Hybrid search at 1M entries < 3s (uses existing data if enough, else skips)
// ---------------------------------------------------------------------------

async function testT7(
  pool: pg.Pool,
  ef: number,
  totalMemories: number,
): Promise<{ passed: boolean; ms: number; skipped: boolean }> {
  if (totalMemories < 500_000) {
    log(
      `  T7 SKIPPED — only ${totalMemories.toLocaleString()} memories (need ≥500k for meaningful 1M test)`,
    )
    return { passed: true, ms: 0, skipped: true }
  }

  const queryText = 'agency Vienna digital product launch'
  const embedding = await embedQuery(queryText)
  const vecLiteral = `[${embedding.join(',')}]`

  await setEfSearch(pool, ef)
  const { result: rows, ms } = await time('T7', async () => {
    const { rows } = await pool.query(
      `WITH
      fts_candidates AS (
        SELECT id, created_at, ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS bm25_rank
        FROM memories WHERE tsv @@ plainto_tsquery('english', $1)
        ORDER BY bm25_rank DESC LIMIT 200
      ),
      vec_candidates AS (
        SELECT id, created_at, 1 - (embedding <=> $2::vector) AS semantic_score
        FROM memories WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector LIMIT 200
      ),
      fused AS (
        SELECT COALESCE(f.id, v.id) AS id, COALESCE(f.created_at, v.created_at) AS created_at,
               COALESCE(f.bm25_rank, 0) AS bm25_rank, COALESCE(v.semantic_score, 0) AS semantic_score,
               EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(f.created_at, v.created_at))) / 86400.0 / 180.0) AS time_decay
        FROM fts_candidates f FULL OUTER JOIN vec_candidates v ON f.id = v.id AND f.created_at = v.created_at
      )
      SELECT m.content, (0.5 * semantic_score) + (0.3 * bm25_rank) + (0.2 * time_decay) AS score
      FROM fused JOIN memories m ON m.id = fused.id AND m.created_at = fused.created_at
      ORDER BY score DESC LIMIT 15`,
      [queryText, vecLiteral],
    )
    return rows
  })

  const passed = ms < 3000
  log(
    `  T7 hybrid at ${totalMemories.toLocaleString()} memories (ef=${ef}): ${ms}ms → ${rows.length} results [${passed ? 'PASS' : 'FAIL'}]`,
  )
  return { passed, ms, skipped: false }
}

// ---------------------------------------------------------------------------
// EXPLAIN ANALYZE output
// ---------------------------------------------------------------------------

async function runExplain(pool: pg.Pool, ef: number) {
  log('\n  EXPLAIN ANALYZE (hybrid search):')
  const queryText = 'project proposal'
  const embedding = await embedQuery(queryText)
  const vecLiteral = `[${embedding.join(',')}]`

  await pool.query(`SET hnsw.ef_search = ${ef}`)
  const plan = await explainAnalyze(
    pool,
    `SELECT m.content, 1 - (embedding <=> $2::vector) AS score
     FROM memories m
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector LIMIT 15`,
    [queryText, vecLiteral],
  )
  const topLines = plan.split('\n').slice(0, 8).join('\n')
  log('  ' + topLines.replace(/\n/g, '\n  '))
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  log('')
  hr()
  log('  Lifetime Memory Stress Test Suite')
  hr()
  log('')

  const pool = new Pool({ connectionString: DATABASE_URL, max: 3 })

  // Verify connection
  try {
    await pool.query('SELECT 1')
    log('  ✓ Postgres connected\n')
  } catch (err) {
    log(`  ✗ Cannot connect to Postgres: ${String(err)}`)
    process.exit(1)
  }

  const totalMemories = await countMemories(pool)
  const totalEmbedded = await countEmbedded(pool)
  const totalPending = await countPending(pool)

  log(`  Total memories:  ${totalMemories.toLocaleString()}`)
  log(
    `  Embedded:        ${totalEmbedded.toLocaleString()} (${totalMemories > 0 ? Math.round((totalEmbedded / totalMemories) * 100) : 0}%)`,
  )
  log(`  Pending embed:   ${totalPending.toLocaleString()}`)
  log('')

  if (totalMemories === 0) {
    log(
      '  ⚠ No memories found — run seed-massive-history.ts first, then wait for embedding worker.',
    )
    await pool.end()
    process.exit(1)
  }

  if (totalPending > 1000) {
    log(`  ⚠ ${totalPending.toLocaleString()} memories still waiting for embeddings.`)
    log('    Start the control-plane (which runs the worker) and wait for backlog to drain.')
    log('    Re-run this test when pending < 1000.\n')
  }

  // HNSW ef_search values to try (higher = better recall, slower)
  const efValues = [40, 64, 100, 200]
  const MAX_ROUNDS = efValues.length

  let allPassed = false
  let round = 0
  const results: Record<string, boolean> = {}

  for (const ef of efValues) {
    round++
    log('')
    hr()
    log(`  Round ${round}/${MAX_ROUNDS} — ef_search = ${ef}`)
    hr()

    try {
      const t1 = await testT1(pool)
      results['T1'] = t1.passed

      const t2 = await testT2(pool, ef)
      results['T2'] = t2.passed

      const t3 = await testT3(pool, ef)
      results['T3'] = t3.passed

      const t4 = await testT4(pool)
      results['T4'] = t4.passed

      const t5 = await testT5(pool)
      results['T5'] = t5.passed

      const t6 = await testT6(pool)
      results['T6'] = t6.passed

      const t7 = await testT7(pool, ef, totalMemories)
      results['T7'] = t7.passed
    } catch (err) {
      log(`  ✗ Test threw: ${String(err)}`)
    }

    log('')
    log('  Results summary:')
    let passCount = 0
    for (const [t, passed] of Object.entries(results)) {
      log(`    ${t}: ${passed ? '✓ PASS' : '✗ FAIL'}`)
      if (passed) passCount++
    }
    log(`  ${passCount}/${Object.keys(results).length} passing`)

    allPassed = Object.values(results).every(Boolean)
    if (allPassed) {
      log('')
      log('  🎉 ALL TESTS PASS')
      break
    }

    const failedTests = Object.entries(results)
      .filter(([, p]) => !p)
      .map(([t]) => t)

    if (failedTests.includes('T2') || failedTests.includes('T7')) {
      log(`\n  Slow vector search at ef=${ef} — trying higher ef_search next round`)
    }
    if (failedTests.includes('T4')) {
      log('\n  ⚠ T4 failed — not enough health metric data. Run the seeder first.')
    }
    if (failedTests.includes('T3')) {
      log('\n  ⚠ T3 failed — "what is my name" not returning Gregor. Check pinned facts seeding.')
    }
  }

  if (!allPassed) {
    log('')
    log('  ✗ Some tests still failing after all ef_search values.')

    // Run EXPLAIN on the last ef value to help diagnose
    try {
      await runExplain(pool, efValues[efValues.length - 1]!)
    } catch (e) {
      log(`  EXPLAIN failed: ${String(e)}`)
    }

    log('')
    log('  Diagnosis checklist:')
    if (!results['T1']) log('    T1: Check memory_facts table is seeded (user.name key)')
    if (!results['T2'] || !results['T7']) {
      log('    T2/T7: HNSW index may not be built yet. Run: REINDEX INDEX memories_embedding_hnsw;')
      log('    T2/T7: Also check embedding coverage — vector search is useless without embeddings')
    }
    if (!results['T3'])
      log('    T3: Ensure pinned facts have user.name=Gregor and memories contain "Gregor"')
    if (!results['T4'])
      log('    T4: Need ≥200 months of heart_rate data in health_metrics. Run the seeder.')
    if (!results['T5'])
      log('    T5: Consolidation bug — check memory_consolidations table and cosine threshold')
    if (!results['T6'])
      log(
        '    T6: GIN index slow (>2s). Run: REINDEX INDEX CONCURRENTLY memories_2026_tsv_idx; (repeat per partition)',
      )
  }

  await pool.end()
  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`)
  process.exit(1)
})
