/**
 * DAY 7 — Full End-to-End Sweep + Final Report
 * Goal: Run ALL feature checks in one pass, generate the final FINDINGS.md summary,
 *       and produce a prioritised BACKLOG.md for the next build sprint.
 */

import { test, chat, cpGet, results, summarize, contains, sleep } from './shared.js'
import { appendFileSync, writeFileSync, readFileSync } from 'fs'

const DAY = 7
const SESSION = `day7-${Date.now()}`

async function run() {
  console.log('🚀 Halo Live Test — Day 7: Full Sweep + Final Report\n')

  // ── Full feature sweep (condensed — one check per feature) ────────────────
  const checks: Array<
    [string, string, () => Promise<{ ok: boolean; notes: string; suggestion?: string }>]
  > = [
    [
      'F-BOOT',
      'Server health',
      async () => {
        const h = (await cpGet('/health')) as Record<string, unknown>
        return { ok: h.status === 'ok', notes: JSON.stringify(h) }
      },
    ],
    [
      'F-001',
      'Basic chat',
      async () => {
        const r = await chat('Say the word PINEAPPLE.', `${SESSION}-f001`)
        return { ok: contains(r, 'pineapple'), notes: r.slice(0, 100) }
      },
    ],
    [
      'F-002',
      'Cross-session memory',
      async () => {
        const r = await chat(
          'Do you remember anything about me from our conversations this week?',
          `${SESSION}-f002`,
        )
        return {
          ok: r.length > 30,
          notes: r.slice(0, 200),
          suggestion: r.length < 30 ? 'Memory not persisting across days' : undefined,
        }
      },
    ],
    [
      'F-003',
      'Semantic search',
      async () => {
        const res = await fetch(
          `${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/memory/search?q=pizza`,
        )
        return { ok: res.ok, notes: `HTTP ${res.status}` }
      },
    ],
    [
      'F-004',
      'Agent CRUD',
      async () => {
        const agents = (await cpGet('/api/agents')) as unknown[]
        return { ok: Array.isArray(agents), notes: `${agents.length} agents` }
      },
    ],
    [
      'F-007',
      'Goals/cron persisted',
      async () => {
        const goals = (await cpGet('/api/goals')) as unknown[]
        return { ok: Array.isArray(goals) && goals.length > 0, notes: `${goals.length} goals` }
      },
    ],
    [
      'F-008',
      'Shell exec works',
      async () => {
        const r = await chat('Run: echo "DAY7_OK"', `${SESSION}-f008`)
        return { ok: contains(r, 'DAY7_OK'), notes: r.slice(0, 100) }
      },
    ],
    [
      'F-009',
      'File read/write works',
      async () => {
        const s = `${SESSION}-f009`
        await chat('Write "FINAL_TEST" to /tmp/day7.txt', s)
        await sleep(500)
        const r = await chat('Read /tmp/day7.txt', s)
        return { ok: contains(r, 'FINAL_TEST'), notes: r.slice(0, 100) }
      },
    ],
    [
      'F-010',
      'Browser navigate',
      async () => {
        const r = await chat('Go to https://example.com and tell me the title.', `${SESSION}-f010`)
        return {
          ok: r.length > 20,
          notes: r.slice(0, 150),
          suggestion: r.length < 20 ? 'Browser tool not responding' : undefined,
        }
      },
    ],
    [
      'F-012',
      'Budget tracking active',
      async () => {
        const stats = (await cpGet('/api/cost-stats')) as Record<string, unknown>
        return { ok: typeof stats === 'object', notes: JSON.stringify(stats).slice(0, 200) }
      },
    ],
    [
      'F-013',
      'Cost dashboard',
      async () => {
        const res = await fetch(`${process.env.HALO_BASE_URL ?? 'http://localhost:3000'}/cost`)
        return { ok: res.ok, notes: `Cost page HTTP ${res.status}` }
      },
    ],
    [
      'F-019',
      'PWA manifest',
      async () => {
        const res = await fetch(
          `${process.env.HALO_BASE_URL ?? 'http://localhost:3000'}/manifest.json`,
        )
        return { ok: res.ok, notes: `Manifest HTTP ${res.status}` }
      },
    ],
    [
      'F-021',
      'Agent proactivity',
      async () => {
        const r = await chat('I want to improve my workflow.', `${SESSION}-f021`)
        return {
          ok: r.includes('?') || contains(r, 'what') || contains(r, 'how'),
          notes: r.slice(0, 150),
        }
      },
    ],
    [
      'F-022',
      'Canvas API',
      async () => {
        const res = await fetch(
          `${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/canvas`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Day7 Final' }),
          },
        )
        return { ok: res.ok || res.status === 201, notes: `HTTP ${res.status}` }
      },
    ],
  ]

  for (const [id, name, fn] of checks) {
    await test(id, name, fn)
    await sleep(200)
  }

  // ── Collect all suggestions from the week ─────────────────────────────────
  const allSuggestions = results
    .filter((r) => r.suggestion)
    .map((r) => `- **[${r.featureId}]** ${r.suggestion}`)

  let findingsIdeas: string[] = []
  try {
    const findings = readFileSync('FINDINGS.md', 'utf-8')
    findingsIdeas = [...findings.matchAll(/\[IDEA[^\]]*\] (.+)/g)].map((m) => `- ${m[1]}`)
  } catch {
    /* no findings yet */
  }

  // ── Generate BACKLOG.md ───────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length
  const total = results.length
  const failRate = (((total - passed) / total) * 100).toFixed(0)

  const backlog = [
    '# Halo — Post-Week-1 Backlog',
    '',
    `> Generated: ${new Date().toISOString().slice(0, 10)}`,
    `> Week 1 test result: ${passed}/${total} passed (${failRate}% failure rate)`,
    '',
    '## Priority 1 — Fix broken features',
    '',
    ...allSuggestions.filter((s) => s.includes('CRITICAL') || s.includes('SECURITY')),
    '',
    '## Priority 2 — Reliability improvements',
    '',
    ...allSuggestions.filter((s) => !s.includes('CRITICAL') && !s.includes('SECURITY')),
    '',
    '## Priority 3 — Feature ideas from testing',
    '',
    ...findingsIdeas,
    '',
    '## Recurring ideas to evaluate',
    '',
    '- [ ] Notification when a goal fires (push/Telegram)',
    '- [ ] Memory diff view (what changed this week)',
    '- [ ] Agent performance score (tracks how often it succeeds at tasks)',
    '- [ ] Auto-summarise long conversations before context window fills',
    '- [ ] Cost alert (email/Telegram when daily spend exceeds threshold)',
    '- [ ] Skill marketplace — share generated skills between users',
    '- [ ] Scheduled memory consolidation (weekly digest of what was learned)',
    '',
    '---',
    '',
    '_Do NOT auto-implement this backlog. Review with the team first._',
    '',
  ].join('\n')

  writeFileSync('BACKLOG.md', backlog)

  // ── Final FINDINGS.md entry ────────────────────────────────────────────────
  const md = summarize(DAY, new Date().toISOString().slice(0, 10))
  appendFileSync('FINDINGS.md', md)
  appendFileSync(
    'FINDINGS.md',
    `\n## Week 1 Final Summary\n\n- Features tested: ${total}\n- Passed: ${passed}\n- Failure rate: ${failRate}%\n- Backlog generated: BACKLOG.md\n`,
  )

  console.log('\n🎉 Week 1 testing complete!')
  console.log(`📊 ${passed}/${total} features passed`)
  console.log('📝 FINDINGS.md updated')
  console.log('📋 BACKLOG.md generated — review before building anything')

  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
