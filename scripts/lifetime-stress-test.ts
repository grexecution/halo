/* eslint-disable no-console */
/**
 * Lifetime Stress Test — 500K+ memories, real query patterns, bottleneck analysis
 *
 * Phase 1: Extend dataset to ~700K memories spanning 2020–2026
 *          Sources: Gmail, ClickUp, WhatsApp, Calendar, Chat, Telegram, GitHub, Notes
 * Phase 2: Benchmark all retrieval paths (FTS, hybrid, fact, health, pagination)
 * Phase 3: Measure EXPLAIN ANALYZE on slow queries, identify missing indexes
 * Phase 4: Fix bottlenecks in-place, re-benchmark
 *
 * Usage:
 *   DATABASE_URL=postgresql://greg:greg@localhost:5432/greg npx tsx scripts/lifetime-stress-test.ts
 */

import pg from 'pg'
import { randomUUID } from 'node:crypto'

const { Pool } = pg

const DB = process.env['DATABASE_URL'] ?? 'postgresql://greg:greg@localhost:5432/greg'
const pool = new Pool({ connectionString: DB, max: 10 })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[rnd(0, arr.length - 1)]!
}
function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}
const START = new Date('2020-01-01T00:00:00Z')
const END = new Date('2026-04-26T00:00:00Z')
function anyDate(): string {
  return randDate(START, END).toISOString()
}

function fmt(ms: number) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// ─── Content generators ───────────────────────────────────────────────────────

const NAMES = [
  'Alice Weber',
  'Bob Müller',
  'Clara Novak',
  'David Chen',
  'Eva Richter',
  'Frank Hofer',
  'Gregor Wallner',
]
const CLIENTS = [
  'TechCorp GmbH',
  'Startup AG',
  'Media House',
  'FinancePro',
  'RetailGroup',
  'HealthTech',
  'EduPlatform',
]
const PROJECTS = [
  'Website Relaunch',
  'Mobile App',
  'Q4 Campaign',
  'Dashboard v2',
  'API Migration',
  'Brand Refresh',
  'SEO Overhaul',
]
const TOOLS = ['VSCode', 'Figma', 'Notion', 'Jira', 'Slack', 'Linear', 'ClickUp', 'GitHub']
const TOPICS = [
  'meeting notes',
  'project update',
  'budget review',
  'design feedback',
  'technical spec',
  'roadmap planning',
  'retrospective',
]

function gmailContent(): string {
  const from = pick(NAMES)
  const subject = `Re: ${pick(TOPICS)} — ${pick(PROJECTS)}`
  const client = pick(CLIENTS)
  const bodies = [
    `Hi, just wanted to follow up on the ${pick(PROJECTS)} for ${client}. Can we schedule a call this week?`,
    `Please find attached the updated proposal for ${pick(TOPICS)}. Let me know your thoughts.`,
    `Quick reminder about our ${pick(TOPICS)} on Friday. ${from} will join us at 3pm.`,
    `I've reviewed the ${pick(PROJECTS)} deliverables. A few items need attention before launch.`,
    `Invoice #${rnd(1000, 9999)} for ${client} — ${pick(PROJECTS)} — €${rnd(500, 15000)}. Payment due in 30 days.`,
    `Regarding the feedback from ${client}: they loved the new design but want iteration on the mobile layout.`,
    `Status update: ${pick(PROJECTS)} is ${rnd(40, 95)}% complete. Expected delivery ${pick(['next week', 'end of month', 'Q3', 'mid-June'])}.`,
  ]
  return `From: ${from}\nSubject: ${subject}\n\n${pick(bodies)}`
}

function whatsappContent(): string {
  const person = pick(NAMES)
  const msgs = [
    `Hey! Quick question about ${pick(PROJECTS)} — when is the deadline?`,
    `Did you see the feedback from ${pick(CLIENTS)}? 😅 We need to talk`,
    `Meeting moved to ${rnd(9, 17)}:${pick(['00', '30'])} tomorrow`,
    `Can you share the login for ${pick(TOOLS)}?`,
    `The client loved it! 🎉 They want to extend the contract`,
    `Running ${rnd(10, 30)} min late, sorry!`,
    `${pick(PROJECTS)} is done — just pushed to staging`,
    `Lunch tomorrow at ${rnd(12, 14)}:00?`,
    `FYI — ${pick(CLIENTS)} changed their mind again on the colors 🙄`,
    `Just saw your message. Yes, let's do it! Will send the brief by EOD`,
  ]
  return `[WhatsApp] ${person}: ${pick(msgs)}`
}

function telegramContent(): string {
  const channels = ['#team-dev', '#clients', '#random', '#design', '#marketing', '#ops']
  const chan = pick(channels)
  const msgs = [
    `Deployed ${pick(PROJECTS)} to production — all systems green ✅`,
    `New task in ${pick(TOOLS)}: ${pick(TOPICS)} for ${pick(CLIENTS)}`,
    `Bug found in auth flow — priority P1, assigning to @dev`,
    `Design review at 4pm today — join the call`,
    `Budget approved for ${pick(PROJECTS)}: €${rnd(5000, 50000)}`,
    `New lead from ${pick(CLIENTS)}: ${pick(PROJECTS)} — send proposal by Friday`,
    `Server load spike: 95% CPU — investigating`,
    `Release v${rnd(1, 4)}.${rnd(0, 9)}.${rnd(0, 20)} shipped`,
    `Reminder: standups at 9am CET every weekday`,
  ]
  return `[Telegram ${chan}] ${pick(msgs)}`
}

function calendarContent(): string {
  const eventTypes = [
    'Meeting',
    'Call',
    'Workshop',
    'Review',
    'Demo',
    'Standup',
    'Lunch',
    'Planning',
    'Retrospective',
  ]
  const et = pick(eventTypes)
  const duration = pick([30, 45, 60, 90, 120])
  const attendees = Array.from({ length: rnd(1, 5) }, () => pick(NAMES)).join(', ')
  return `[Calendar] ${et}: ${pick(TOPICS)} — ${pick(PROJECTS)} with ${pick(CLIENTS)}. ${duration} min. Attendees: ${attendees}.`
}

function clickupContent(): string {
  const statuses = ['Todo', 'In Progress', 'In Review', 'Done', 'Blocked']
  const priorities = ['Urgent', 'High', 'Normal', 'Low']
  return `[ClickUp] Task: ${pick(TOPICS)} for ${pick(PROJECTS)} — Priority: ${pick(priorities)}, Status: ${pick(statuses)}, Assigned to: ${pick(NAMES)}, Due: ${new Date(Date.now() + rnd(-30, 60) * 86400000).toISOString().slice(0, 10)}`
}

function chatContent(): string {
  const turns = [
    `User: Can you help me draft an email to ${pick(CLIENTS)} about ${pick(PROJECTS)}?\nHalo: Sure! Here's a draft...`,
    `User: What's the status of ${pick(PROJECTS)}?\nHalo: Based on your recent updates, ${pick(PROJECTS)} is progressing well.`,
    `User: Summarize my emails from today\nHalo: You have ${rnd(3, 20)} unread emails. Key items: ...`,
    `User: Schedule a meeting with ${pick(NAMES)} about ${pick(TOPICS)}\nHalo: I've added "${pick(TOPICS)} with ${pick(NAMES)}" to your calendar for tomorrow at ${rnd(9, 17)}:00.`,
    `User: How's my sleep been this month?\nHalo: Your average sleep this month is ${(rnd(55, 85) / 10).toFixed(1)} hours, which is ${pick(['above', 'below', 'on par with'])} your goal.`,
    `User: Write a proposal for ${pick(CLIENTS)}\nHalo: I'll create a proposal for ${pick(PROJECTS)}. Based on your previous work with similar clients...`,
    `User: What did I work on last week?\nHalo: Last week you focused on: ${pick(PROJECTS)}, ${pick(TOPICS)}, and meetings with ${pick(CLIENTS)}.`,
  ]
  return pick(turns)
}

function githubContent(): string {
  const repos = ['dashboard', 'api-server', 'mobile-app', 'design-system', 'docs', 'analytics']
  const events = [
    'PR merged',
    'Issue opened',
    'Comment',
    'Review requested',
    'Branch created',
    'Release published',
  ]
  const repo = pick(repos)
  const event = pick(events)
  return `[GitHub] ${event} in ${repo}: ${pick(TOPICS)} — ${pick(NAMES)} · ${pick(PROJECTS)}`
}

function noteContent(): string {
  const notes = [
    `Meeting notes — ${pick(TOPICS)}: Discussed ${pick(PROJECTS)} with ${pick(CLIENTS)}. Action items: 1) ${pick(NAMES)} to send proposal, 2) Schedule follow-up for next week`,
    `Ideas for ${pick(PROJECTS)}: Use ${pick(TOOLS)} for collaboration. Consider ${pick(['dark mode', 'mobile-first', 'real-time sync', 'offline support'])}.`,
    `${pick(CLIENTS)} feedback: Liked the direction. Wants changes to navigation and ${pick(['colors', 'typography', 'layout', 'animations'])}.`,
    `Daily log: Worked on ${pick(PROJECTS)} (${rnd(2, 6)}h), had ${rnd(2, 6)} meetings, resolved ${rnd(1, 10)} ${pick(['bugs', 'tasks', 'tickets'])}.`,
    `Reference: ${pick(TOOLS)} API docs. Key methods: ${pick(['create', 'update', 'delete', 'list', 'search'])} — pagination via cursor.`,
  ]
  return pick(notes)
}

// ─── Dataset generation plan ──────────────────────────────────────────────────

interface MemoryBatch {
  id: string
  content: string
  source: string
  source_id: string | null
  type: string
  tags: string[]
  created_at: string
}

const SOURCES: Array<{ source: string; type: string; count: number; gen: () => string }> = [
  { source: 'email', type: 'email', count: 30000, gen: gmailContent },
  { source: 'whatsapp', type: 'message', count: 20000, gen: whatsappContent },
  { source: 'telegram', type: 'message', count: 20000, gen: telegramContent },
  { source: 'calendar', type: 'event', count: 15000, gen: calendarContent },
  { source: 'clickup', type: 'task', count: 15000, gen: clickupContent },
  { source: 'chat', type: 'turn', count: 20000, gen: chatContent },
  { source: 'github', type: 'event', count: 10000, gen: githubContent },
  { source: 'note', type: 'note', count: 10000, gen: noteContent },
]

const TOTAL_NEW = SOURCES.reduce((s, x) => s + x.count, 0) // 140,000 new records

// ─── Phase 1: Bulk insert ─────────────────────────────────────────────────────

async function phase1_seed(): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 1: Seeding ${TOTAL_NEW.toLocaleString()} new memories`)
  console.log(`${'─'.repeat(60)}`)

  let totalInserted = 0
  const BATCH = 500

  for (const { source, type, count, gen } of SOURCES) {
    const t0 = Date.now()
    let inserted = 0

    for (let batch = 0; batch < count; batch += BATCH) {
      const size = Math.min(BATCH, count - batch)
      const rows: MemoryBatch[] = Array.from({ length: size }, (_, i) => ({
        id: randomUUID(),
        content: gen(),
        source,
        source_id: `${source}-${batch + i}-${Date.now()}`,
        type,
        tags: [source, type, pick(PROJECTS).toLowerCase().replace(/\s+/g, '-')],
        created_at: anyDate(),
      }))

      // Build VALUES for batch insert
      const values: unknown[] = []
      const placeholders = rows.map((r, i) => {
        const base = i * 7
        values.push(r.id, r.content, r.source, r.source_id, r.type, r.created_at, r.created_at)
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7},
                 ARRAY[${r.tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(',')}]::text[], '{}',
                 to_tsvector('english', $${base + 2}))`
      })

      await pool.query(
        `INSERT INTO memories (id, content, source, source_id, type, created_at, updated_at, tags, metadata, tsv)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (id, created_at) DO NOTHING`,
        values,
      )

      inserted += size
      totalInserted += size
    }

    const elapsed = Date.now() - t0
    const rate = Math.round(inserted / (elapsed / 1000))
    console.log(
      `  ✓ ${source.padEnd(10)} ${inserted.toLocaleString().padStart(6)} rows — ${fmt(elapsed)} (${rate.toLocaleString()}/s)`,
    )
  }

  // Queue embedding jobs for all new unembedded memories
  console.log(`\n  Queuing embedding jobs for unembedded memories...`)
  const { rows } = await pool.query(
    `INSERT INTO embedding_jobs (memory_id, priority)
     SELECT id, 10 FROM memories WHERE embedding IS NULL
     ON CONFLICT DO NOTHING
     RETURNING id`,
  )
  console.log(`  ✓ Queued ${rows.length.toLocaleString()} embedding jobs`)
  console.log(`\n  Total inserted: ${totalInserted.toLocaleString()} memories`)
}

// ─── Phase 2: Benchmark all query paths ──────────────────────────────────────

interface BenchResult {
  name: string
  p50: number
  p95: number
  p99: number
  rows: number
  errors: number
}

async function bench(name: string, fn: () => Promise<number>, iters = 20): Promise<BenchResult> {
  const times: number[] = []
  let errors = 0
  let rows = 0
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now()
    try {
      rows = await fn()
    } catch {
      errors++
    }
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return {
    name,
    p50: times[Math.floor(times.length * 0.5)]!,
    p95: times[Math.floor(times.length * 0.95)]!,
    p99: times[Math.floor(times.length * 0.99)] ?? times[times.length - 1]!,
    rows,
    errors,
  }
}

async function phase2_benchmark(): Promise<BenchResult[]> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 2: Benchmarking retrieval paths`)
  console.log(`${'─'.repeat(60)}`)

  const results: BenchResult[] = []

  // T1: FTS search — BM25 only
  results.push(
    await bench(
      'T1: FTS search (BM25)',
      async () => {
        const queries = [
          'meeting client proposal',
          'project deadline urgent',
          'invoice payment',
          'bug fix deployment',
          'design feedback',
        ]
        const q = pick(queries)
        const { rows } = await pool.query(
          `SELECT id, content, ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS score
       FROM memories
       WHERE tsv @@ plainto_tsquery('english', $1)
       ORDER BY score DESC, created_at DESC
       LIMIT 10`,
          [q],
        )
        return rows.length
      },
      30,
    ),
  )

  // T2: FTS with source filter
  results.push(
    await bench(
      'T2: FTS + source filter',
      async () => {
        const sources = ['email', 'chat', 'whatsapp', 'calendar']
        const { rows } = await pool.query(
          `SELECT id, content FROM memories
       WHERE tsv @@ plainto_tsquery('english', $1)
         AND source = $2
       ORDER BY created_at DESC
       LIMIT 10`,
          ['meeting', pick(sources)],
        )
        return rows.length
      },
      30,
    ),
  )

  // T3: Date range query
  results.push(
    await bench(
      'T3: Recent memories (date range)',
      async () => {
        const { rows } = await pool.query(
          `SELECT id, content, source, created_at FROM memories
       WHERE created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT 50`,
        )
        return rows.length
      },
      30,
    ),
  )

  // T4: COUNT + pagination (the dashboard /you page Memory tab)
  results.push(
    await bench(
      'T4: Dashboard memory pagination',
      async () => {
        const offset = rnd(0, 1000)
        const { rows } = await pool.query(
          `SELECT id, content, source, type, created_at FROM memories
       ORDER BY created_at DESC
       LIMIT 50 OFFSET $1`,
          [offset],
        )
        return rows.length
      },
      30,
    ),
  )

  // T5: COUNT total
  results.push(
    await bench(
      'T5: COUNT(*) total',
      async () => {
        const { rows } = await pool.query('SELECT COUNT(*) AS n FROM memories')
        return parseInt(rows[0]?.n ?? '0', 10)
      },
      20,
    ),
  )

  // T6: GROUP BY source
  results.push(
    await bench(
      'T6: GROUP BY source stats',
      async () => {
        const { rows } = await pool.query(
          'SELECT source, COUNT(*) AS n FROM memories GROUP BY source ORDER BY n DESC',
        )
        return rows.length
      },
      20,
    ),
  )

  // T7: Health trend query
  results.push(
    await bench(
      'T7: Health trend (monthly, 12mo)',
      async () => {
        const metrics = ['heart_rate', 'steps', 'sleep_hours', 'hrv']
        const { rows } = await pool.query(
          `SELECT DATE_TRUNC('month', recorded_at) AS bucket, AVG(value), COUNT(*)
       FROM health_metrics
       WHERE metric_type = $1 AND recorded_at >= NOW() - INTERVAL '12 months'
       GROUP BY bucket ORDER BY bucket`,
          [pick(metrics)],
        )
        return rows.length
      },
      20,
    ),
  )

  // T8: Embedding backlog check
  results.push(
    await bench(
      'T8: Embedding queue depth',
      async () => {
        const { rows } = await pool.query(
          "SELECT COUNT(*) AS n FROM embedding_jobs WHERE status = 'pending'",
        )
        return parseInt(rows[0]?.n ?? '0', 10)
      },
      10,
    ),
  )

  // T9: Memory facts lookup
  results.push(
    await bench(
      'T9: Fact lookup',
      async () => {
        const keys = ['user.name', 'user.company', 'user.occupation', 'user.location']
        const { rows } = await pool.query('SELECT value FROM memory_facts WHERE key = $1', [
          pick(keys),
        ])
        return rows.length
      },
      30,
    ),
  )

  // T10: Recent + source + text search (realistic orchestrator query)
  results.push(
    await bench(
      'T10: Orchestrator realistic query',
      async () => {
        const q = pick([
          'project update client',
          'invoice deadline',
          'meeting notes',
          'task completed',
          'design review',
        ])
        const { rows } = await pool.query(
          `SELECT id, content, source, created_at,
              ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS score
       FROM memories
       WHERE tsv @@ plainto_tsquery('english', $1)
         AND created_at >= NOW() - INTERVAL '365 days'
       ORDER BY score DESC, created_at DESC
       LIMIT 5`,
          [q],
        )
        return rows.length
      },
      30,
    ),
  )

  // T11: Full-table sequential scan (worst case — no filter)
  results.push(
    await bench(
      'T11: Large OFFSET pagination (p100)',
      async () => {
        const { rows } = await pool.query(
          `SELECT id, content FROM memories ORDER BY created_at DESC LIMIT 20 OFFSET 10000`,
        )
        return rows.length
      },
      10,
    ),
  )

  // T12: Partition pruning test
  results.push(
    await bench(
      'T12: Single-partition query (2023)',
      async () => {
        const { rows } = await pool.query(
          `SELECT COUNT(*) AS n FROM memories
       WHERE created_at >= '2023-01-01' AND created_at < '2024-01-01'`,
        )
        return parseInt(rows[0]?.n ?? '0', 10)
      },
      20,
    ),
  )

  // T13: Concurrent connections under load
  results.push(
    await bench(
      'T13: 5 concurrent FTS queries',
      async () => {
        const queries = Array.from({ length: 5 }, () =>
          pool.query(
            `SELECT id FROM memories WHERE tsv @@ plainto_tsquery('english', $1) LIMIT 10`,
            [pick(['meeting', 'project', 'invoice', 'client', 'deadline'])],
          ),
        )
        const results = await Promise.all(queries)
        return results.reduce((s, r) => s + r.rows.length, 0)
      },
      10,
    ),
  )

  // Print results
  console.log(
    `\n  ${'Test'.padEnd(45)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'rows'.padStart(6)} ${'err'.padStart(4)}`,
  )
  console.log(`  ${'─'.repeat(82)}`)
  for (const r of results) {
    const p50 = fmt(r.p50)
    const p95 = fmt(r.p95)
    const p99 = fmt(r.p99)
    const flag = r.p95 > 500 ? ' ⚠️ SLOW' : r.errors > 0 ? ' ❌ ERRORS' : ' ✓'
    console.log(
      `  ${r.name.padEnd(45)} ${p50.padStart(8)} ${p95.padStart(8)} ${p99.padStart(8)} ${String(r.rows).padStart(6)} ${String(r.errors).padStart(4)}${flag}`,
    )
  }

  return results
}

// ─── Phase 3: EXPLAIN ANALYZE on slow queries ─────────────────────────────────

async function phase3_explain(results: BenchResult[]): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 3: EXPLAIN ANALYZE on slow paths (p95 > 100ms)`)
  console.log(`${'─'.repeat(60)}`)

  const slowTests = results.filter((r) => r.p95 > 100)
  if (slowTests.length === 0) {
    console.log('  All queries under 100ms p95 — nothing to analyze!')
    return
  }

  // Run EXPLAIN ANALYZE on the important ones
  const analyzeQueries: Array<{ name: string; sql: string; params: unknown[] }> = [
    {
      name: 'FTS search',
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT id, content, ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS score
            FROM memories WHERE tsv @@ plainto_tsquery('english', $1)
            ORDER BY score DESC LIMIT 10`,
      params: ['meeting project client'],
    },
    {
      name: 'DATE RANGE scan',
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT id, content FROM memories
            WHERE created_at >= NOW() - INTERVAL '30 days'
            ORDER BY created_at DESC LIMIT 50`,
      params: [],
    },
    {
      name: 'Dashboard pagination',
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
            SELECT id, content, source FROM memories
            ORDER BY created_at DESC LIMIT 50 OFFSET 1000`,
      params: [],
    },
  ]

  for (const { name, sql, params } of analyzeQueries) {
    console.log(`\n  ── ${name} ──`)
    try {
      const { rows } = await pool.query(sql, params)
      const plan = rows.map((r: Record<string, unknown>) => Object.values(r)[0]).join('\n')
      // Show key lines
      const keyLines = plan
        .split('\n')
        .filter((l: string) =>
          /Seq Scan|Index Scan|Bitmap|cost=|rows=|actual time|Rows Removed|Parallel/i.test(l),
        )
      console.log(
        keyLines
          .slice(0, 8)
          .map((l: string) => `    ${l}`)
          .join('\n'),
      )
    } catch (err) {
      console.log(`    Error: ${String(err)}`)
    }
  }
}

// ─── Phase 4: Index optimizations ────────────────────────────────────────────

async function phase4_fix_indexes(): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 4: Applying index optimizations`)
  console.log(`${'─'.repeat(60)}`)

  const fixes: Array<{ name: string; sql: string }> = [
    {
      name: 'Index: memories created_at DESC (for pagination)',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_created_at_desc
            ON memories (created_at DESC)`,
    },
    {
      name: 'Index: memories source + created_at (for source-filtered pagination)',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_source_created
            ON memories (source, created_at DESC)`,
    },
    {
      name: 'Index: embedding_jobs pending priority (compound)',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS embedding_jobs_pending_priority
            ON embedding_jobs (priority ASC, id ASC)
            WHERE status = 'pending' AND attempts < 3`,
    },
    {
      name: 'Index: health_metrics recorded_at DESC',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS health_metrics_recorded_at_desc
            ON health_metrics (recorded_at DESC)`,
    },
  ]

  for (const { name, sql } of fixes) {
    const t0 = Date.now()
    try {
      await pool.query(sql)
      console.log(`  ✓ ${name} — ${fmt(Date.now() - t0)}`)
    } catch (err: unknown) {
      const msg = String((err as { message?: string }).message ?? err)
      if (msg.includes('already exists')) {
        console.log(`  · ${name} — already exists`)
      } else {
        console.log(`  ✗ ${name} — ${msg}`)
      }
    }
  }

  // Also VACUUM ANALYZE to refresh planner statistics after big insert
  console.log(`\n  Running ANALYZE to refresh query planner stats...`)
  const t0 = Date.now()
  await pool.query('ANALYZE memories, health_metrics, embedding_jobs')
  console.log(`  ✓ ANALYZE — ${fmt(Date.now() - t0)}`)
}

// ─── Phase 5: Post-fix re-benchmark ──────────────────────────────────────────

async function phase5_recheck(): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 5: Re-benchmark after optimizations`)
  console.log(`${'─'.repeat(60)}`)

  const critical = [
    {
      name: 'FTS search',
      sql: `SELECT id, content, ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS score FROM memories WHERE tsv @@ plainto_tsquery('english', $1) ORDER BY score DESC LIMIT 10`,
      params: (q: string) => [q],
    },
    {
      name: 'Date range',
      sql: `SELECT id, content FROM memories WHERE created_at >= NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 50`,
      params: () => [],
    },
    {
      name: 'Pagination p1',
      sql: `SELECT id, content, source FROM memories ORDER BY created_at DESC LIMIT 50 OFFSET 0`,
      params: () => [],
    },
    {
      name: 'Pagination p100',
      sql: `SELECT id, content, source FROM memories ORDER BY created_at DESC LIMIT 50 OFFSET 5000`,
      params: () => [],
    },
    {
      name: 'Source filter',
      sql: `SELECT id, content FROM memories WHERE source = $1 AND created_at >= NOW() - INTERVAL '90 days' ORDER BY created_at DESC LIMIT 20`,
      params: () => [pick(['email', 'chat', 'whatsapp'])],
    },
    {
      name: 'Health trend',
      sql: `SELECT DATE_TRUNC('month', recorded_at) AS b, AVG(value) FROM health_metrics WHERE metric_type = $1 GROUP BY b ORDER BY b`,
      params: () => ['heart_rate'],
    },
  ]

  console.log(
    `\n  ${'Query'.padEnd(25)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'rows'.padStart(6)}`,
  )
  console.log(`  ${'─'.repeat(52)}`)

  for (const { name, sql, params } of critical) {
    const times: number[] = []
    let rows = 0
    for (let i = 0; i < 20; i++) {
      const p = params(pick(['meeting', 'project', 'invoice', 'client']))
      const t0 = performance.now()
      const r = await pool.query(sql, p)
      times.push(performance.now() - t0)
      rows = r.rows.length
    }
    times.sort((a, b) => a - b)
    const p50 = times[Math.floor(times.length * 0.5)]!
    const p95 = times[Math.floor(times.length * 0.95)]!
    const flag = p95 > 200 ? ' ⚠️' : ' ✓'
    console.log(
      `  ${name.padEnd(25)} ${fmt(p50).padStart(8)} ${fmt(p95).padStart(8)} ${String(rows).padStart(6)}${flag}`,
    )
  }
}

// ─── Phase 6: Database health report ─────────────────────────────────────────

async function phase6_health_report(): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 6: Database health report`)
  console.log(`${'─'.repeat(60)}`)

  // Row counts
  const { rows: counts } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM memories)       AS memories,
      (SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL) AS embedded,
      (SELECT COUNT(*) FROM memories WHERE embedding IS NULL) AS unembedded,
      (SELECT COUNT(*) FROM embedding_jobs WHERE status = 'pending') AS pending_jobs,
      (SELECT COUNT(*) FROM embedding_jobs WHERE status = 'failed') AS failed_jobs,
      (SELECT COUNT(*) FROM health_metrics) AS health_metrics,
      (SELECT COUNT(*) FROM memory_facts)   AS facts
  `)
  const c = counts[0]!
  const total = parseInt(c.memories, 10)
  const embedded = parseInt(c.embedded, 10)
  const pct = ((embedded / total) * 100).toFixed(1)

  console.log(`\n  Dataset size:`)
  console.log(`    Memories total:   ${parseInt(c.memories, 10).toLocaleString()}`)
  console.log(`    Embedded:         ${embedded.toLocaleString()} (${pct}%)`)
  console.log(
    `    Unembedded:       ${parseInt(c.unembedded, 10).toLocaleString()} (need FastEmbed)`,
  )
  console.log(`    Pending jobs:     ${parseInt(c.pending_jobs, 10).toLocaleString()}`)
  console.log(`    Failed jobs:      ${parseInt(c.failed_jobs, 10).toLocaleString()}`)
  console.log(`    Health metrics:   ${parseInt(c.health_metrics, 10).toLocaleString()}`)
  console.log(`    Memory facts:     ${c.facts}`)

  // Date span
  const { rows: span } = await pool.query(
    'SELECT MIN(created_at) AS oldest, MAX(created_at) AS newest FROM memories',
  )
  console.log(`\n  Date span:`)
  console.log(`    Oldest memory: ${span[0]?.oldest?.toISOString().slice(0, 10)}`)
  console.log(`    Newest memory: ${span[0]?.newest?.toISOString().slice(0, 10)}`)

  // Per-source breakdown
  const { rows: bySource } = await pool.query(
    'SELECT source, COUNT(*) AS n FROM memories GROUP BY source ORDER BY n DESC',
  )
  console.log(`\n  By source:`)
  for (const row of bySource) {
    const bar = '█'.repeat(Math.round(parseInt(row.n, 10) / 5000))
    console.log(
      `    ${row.source.padEnd(12)} ${String(parseInt(row.n, 10).toLocaleString()).padStart(8)}  ${bar}`,
    )
  }

  // Table bloat / index sizes
  const { rows: sizes } = await pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS total_size,
      pg_size_pretty(pg_relation_size(quote_ident(tablename))) AS table_size
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('memories', 'embedding_jobs', 'health_metrics', 'memory_facts')
    ORDER BY pg_total_relation_size(quote_ident(tablename)) DESC
  `)
  console.log(`\n  Table sizes:`)
  for (const r of sizes) {
    console.log(
      `    ${r.tablename.padEnd(20)} total=${r.total_size.padStart(10)}, table=${r.table_size.padStart(10)}`,
    )
  }

  // Index usage
  const { rows: idxUsage } = await pool.query(`
    SELECT
      indexrelname AS index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
      idx_scan AS scans
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND relname IN ('memories', 'embedding_jobs', 'health_metrics')
    ORDER BY idx_scan DESC
    LIMIT 15
  `)
  console.log(`\n  Top index usage:`)
  for (const r of idxUsage) {
    console.log(`    ${r.index_name.padEnd(45)} size=${r.index_size.padStart(8)}, scans=${r.scans}`)
  }

  // Failed embedding jobs analysis
  const { rows: failedSample } = await pool.query(
    "SELECT memory_id, last_error, attempts FROM embedding_jobs WHERE status = 'failed' LIMIT 5",
  )
  if (failedSample.length > 0) {
    console.log(`\n  Failed embedding jobs (sample):`)
    for (const r of failedSample) {
      console.log(
        `    memory_id=${r.memory_id}, attempts=${r.attempts}, error=${r.last_error?.slice(0, 80)}`,
      )
    }
  }
}

// ─── Phase 7: Fix the embedding job deduplication bloat ──────────────────────

async function phase7_cleanup_jobs(): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PHASE 7: Cleaning up embedding job bloat`)
  console.log(`${'─'.repeat(60)}`)

  // The issue: 2.3M jobs for 549K memories = 4x duplication
  // Root cause: seed script re-queues all unembedded memories on every run
  // Fix: delete done jobs and deduplicate pending jobs (keep lowest id per memory_id)

  const t0 = Date.now()

  // Delete all "done" jobs (no longer needed)
  const { rowCount: doneDel } = await pool.query("DELETE FROM embedding_jobs WHERE status = 'done'")
  console.log(`  ✓ Deleted ${(doneDel ?? 0).toLocaleString()} done jobs — ${fmt(Date.now() - t0)}`)

  // Deduplicate pending jobs — keep only the lowest id per memory_id
  const t1 = Date.now()
  const { rowCount: dedupDel } = await pool.query(
    `DELETE FROM embedding_jobs ej
     USING (
       SELECT memory_id, MIN(id) AS keep_id
       FROM embedding_jobs
       WHERE status = 'pending'
       GROUP BY memory_id
     ) keep
     WHERE ej.memory_id = keep.memory_id
       AND ej.id != keep.keep_id
       AND ej.status = 'pending'`,
  )
  console.log(
    `  ✓ Deduplicated ${(dedupDel ?? 0).toLocaleString()} duplicate pending jobs — ${fmt(Date.now() - t1)}`,
  )

  // Final count
  const { rows } = await pool.query(
    'SELECT status, COUNT(*) as n FROM embedding_jobs GROUP BY status ORDER BY status',
  )
  console.log(`\n  Embedding jobs after cleanup:`)
  for (const r of rows) {
    console.log(`    ${r.status.padEnd(12)} ${parseInt(r.n, 10).toLocaleString()}`)
  }

  // Also fix the UNIQUE constraint on embedding_jobs to prevent future bloat
  console.log(`\n  Adding UNIQUE constraint on (memory_id) to prevent re-queuing...`)
  try {
    await pool.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS embedding_jobs_memory_id_unique
      ON embedding_jobs (memory_id)
      WHERE status IN ('pending', 'processing')
    `)
    console.log(`  ✓ UNIQUE index on pending/processing jobs created`)
  } catch (err: unknown) {
    const msg = String((err as { message?: string }).message ?? err)
    console.log(`  · ${msg.slice(0, 80)}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  OPEN-GREG LIFETIME STRESS TEST`)
  console.log(`  ${new Date().toISOString()}`)
  console.log(`${'═'.repeat(60)}`)

  try {
    // Verify connection
    const { rows } = await pool.query('SELECT version() AS v')
    console.log(`\n  Connected: ${((rows[0]?.v as string) ?? '').split(' ').slice(0, 2).join(' ')}`)

    await phase1_seed()
    const benchResults = await phase2_benchmark()
    await phase3_explain(benchResults)
    await phase4_fix_indexes()
    await phase5_recheck()
    await phase7_cleanup_jobs()
    await phase6_health_report()

    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  STRESS TEST COMPLETE`)
    console.log(`${'═'.repeat(60)}\n`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
