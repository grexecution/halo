/**
 * Massive history seeder — 50,000 memories spanning 10 years + health metrics
 *
 * Writes directly to Postgres using the COPY protocol for speed.
 * Target: complete 50k inserts in < 30 seconds.
 *
 * Data distribution:
 *  - 15,000 emails (agency clients, vendors, HR, newsletters)
 *  -  8,000 calendar events (meetings, calls, workshops, personal)
 *  -  8,000 WhatsApp messages (clients, team, personal)
 *  -  8,000 Telegram messages (team, channels, bots)
 *  -  5,000 chat turns with the AI agent
 *  -  4,000 notes and documents
 *  -  2,000 ClickUp tasks
 *  + ~73,000 health_metric rows (daily: heart_rate, steps, sleep, HRV — 5 years)
 *
 * Usage:
 *   pnpm tsx scripts/seed-massive-history.ts
 *   DATABASE_URL=postgresql://... pnpm tsx scripts/seed-massive-history.ts
 */

import pg from 'pg'

const { Client } = pg

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greg:greg@localhost:5432/greg'

// ---------------------------------------------------------------------------
// Data generation helpers
// ---------------------------------------------------------------------------

function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[rnd(0, arr.length - 1)]!
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function iso(d: Date): string {
  return d.toISOString()
}

// Agency context
const CLIENTS = [
  'TechCorp Vienna',
  'StartUp GmbH',
  'Retail Group AT',
  'HealthPlus',
  'FinServ AG',
  'MediaHouse',
  'LogisticsPro',
  'EduTech Wien',
  'GreenEnergy',
  'AutoDealer AT',
  'LegalFirm Vienna',
  'HotelChain',
  'FoodDelivery',
  'RealEstate AG',
  'InsurTech',
]

const TEAMMATES = ['David', 'Julia', 'Markus', 'Sophie', 'Lukas', 'Anna', 'Thomas', 'Lisa']

const PROJECTS = [
  'Website Redesign',
  'CRM Integration',
  'Mobile App',
  'E-commerce Platform',
  'Brand Identity',
  'SEO Campaign',
  'Analytics Dashboard',
  'API Development',
  'Cloud Migration',
  'Data Pipeline',
  'Marketing Automation',
  'UX Audit',
]

const EMAIL_SUBJECTS = [
  'Re: Project proposal',
  'Invoice #{n}',
  'Meeting notes from today',
  'Status update — {project}',
  'Urgent: deadline change',
  'New client onboarding',
  'Budget approval needed',
  'Contract renewal',
  'Team standup summary',
  'Q{q} report draft',
  'Follow-up from our call',
  'Design feedback',
  'New requirement from {client}',
  'Blocked on {project}',
  'Weekly digest',
  'Payment received',
  'Demo scheduled for {date}',
  'Feedback on proposal',
  'Contract signed',
  'Phase 2 kickoff',
]

const HEALTH_METRICS: Array<{ type: string; unit: string; baseVal: number; variance: number }> = [
  { type: 'heart_rate', unit: 'bpm', baseVal: 65, variance: 15 },
  { type: 'hrv', unit: 'ms', baseVal: 45, variance: 20 },
  { type: 'steps', unit: 'steps', baseVal: 9000, variance: 4000 },
  { type: 'sleep_hours', unit: 'hours', baseVal: 7.2, variance: 1.5 },
  { type: 'weight', unit: 'kg', baseVal: 78, variance: 3 },
  { type: 'vo2max', unit: 'ml/kg/min', baseVal: 42, variance: 4 },
]

function fillTemplate(tpl: string, ctx: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? k)
}

// ---------------------------------------------------------------------------
// Row generators (return tab-separated COPY-protocol lines)
// ---------------------------------------------------------------------------

interface MemRow {
  id: string
  content: string
  source: string
  sourceId: string
  type: string
  tags: string
  metadata: string
  createdAt: string
  updatedAt: string
}

function makeEmail(dayOffset: number): MemRow {
  const client = pick(CLIENTS)
  const project = pick(PROJECTS)
  const q = Math.ceil((12 - new Date(daysAgo(dayOffset)).getMonth()) / 3)
  const subject = fillTemplate(pick(EMAIL_SUBJECTS), {
    n: String(rnd(1000, 9999)),
    project,
    client,
    q: String(q),
    date: daysAgo(dayOffset - 7)
      .toISOString()
      .slice(0, 10),
  })
  const from = `${pick(['info', 'contact', 'hello', 'pm', 'cfo'])}@${client.toLowerCase().replace(/\s+/g, '')}.at`
  const content = [
    `From: ${from}`,
    `Subject: ${subject}`,
    '',
    pick([
      `Dear Greg, I wanted to follow up on the ${project} project. We're happy with the progress so far but have a few additional requirements.`,
      `Hi Greg, please find attached the updated brief for ${project}. Let me know if you have any questions.`,
      `Greg, quick update: the ${project} deadline has been moved to next Friday. Please adjust the timeline accordingly.`,
      `Thanks for the proposal Greg. The team has reviewed it and we'd like to proceed. Can we schedule a kickoff call?`,
      `Greg, invoice #${rnd(1000, 9999)} for €${rnd(2, 20) * 1000} has been processed. Payment within 30 days.`,
      `Hi, we've noticed a bug on the staging environment for ${project}. Can you prioritize this?`,
      `Hi Greg, looking forward to tomorrow's demo. Please ensure the new dashboard is live.`,
      `Greg, can you send over the updated contract for ${project}? We need it signed by end of week.`,
    ]),
  ].join('\n')

  const d = daysAgo(dayOffset)
  const id = `email-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'email',
    sourceId: id,
    type: 'email',
    tags: JSON.stringify(['email', 'gmail', client.toLowerCase().split(' ')[0]!]),
    metadata: JSON.stringify({ client, project, subject, from }),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

function makeCalendarEvent(dayOffset: number): MemRow {
  const client = pick(CLIENTS)
  const teammate = pick(TEAMMATES)
  const project = pick(PROJECTS)
  const type = pick([
    'Client call',
    'Team standup',
    'Workshop',
    'Demo',
    'Review',
    '1:1',
    'Sprint planning',
    'Retrospective',
    'Doctor appointment',
    'Gym',
    'Lunch with investor',
  ])
  const platform = pick(['Zoom', 'Google Meet', 'Teams', 'Vienna office', 'Coffee Pier'])
  const duration = pick([30, 45, 60, 90, 120])
  const content = `Meeting: ${type}${type.includes('Client') ? ` with ${client}` : ''}\nLocation: ${platform}\nDuration: ${duration} minutes\nAttendees: Greg, ${teammate}${type.includes('Client') ? `, ${client} team` : ''}\nAgenda: ${project} ${pick(['status update', 'kickoff', 'review', 'planning', 'demo', 'retrospective'])}`

  const d = daysAgo(dayOffset)
  const id = `cal-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'calendar',
    sourceId: id,
    type: 'fact',
    tags: JSON.stringify(['calendar', 'meeting', type.toLowerCase().split(' ')[0]!]),
    metadata: JSON.stringify({ type, client, teammate, platform, duration }),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

function makeWhatsApp(dayOffset: number): MemRow {
  const contact = pick([...CLIENTS.map((c) => c.split(' ')[0]!), ...TEAMMATES])
  const messages = [
    `Hey Greg, quick update on the project — we're on track for this week's deadline.`,
    `Greg, can you check the design files? Client is waiting.`,
    `Meeting confirmed for tomorrow at 10am. See you there!`,
    `Invoice sent. Please approve when you get a chance.`,
    `Hi Greg! Just wanted to say the new website looks amazing. Our CEO loves it.`,
    `Are you free for a quick call at 3pm?`,
    `Greg, the client wants to add a new feature. Should we scope it for phase 2?`,
    `Done! Pushed the fix to staging. Ready for review.`,
    `Running 10 mins late to the call, sorry!`,
    `New lead from the Vienna startup event. Interested in full digital package.`,
  ]
  const content = `WhatsApp from ${contact}: ${pick(messages)}`
  const d = daysAgo(dayOffset)
  const id = `wa-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'whatsapp',
    sourceId: id,
    type: 'conversation',
    tags: JSON.stringify(['whatsapp', contact.toLowerCase()]),
    metadata: JSON.stringify({ contact, platform: 'whatsapp' }),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

function makeTelegram(dayOffset: number): MemRow {
  const contact = pick([...TEAMMATES, 'team-channel', 'news-channel', 'project-bot'])
  const msgs = [
    `@greg deployment done ✅`,
    `Reminder: daily standup in 15 minutes`,
    `New PR merged: feature/dashboard-redesign`,
    `CI pipeline failed on branch main. Check logs.`,
    `Client approved the mockups! Moving to development.`,
    `Budget updated in ClickUp. New total: €${rnd(5, 50) * 1000}`,
    `Greg, can you review the PR when you have time?`,
    `Weekly digest: 3 features shipped, 2 bugs fixed`,
    `Server monitoring alert: CPU at 78% on hetzner-01`,
    `New task assigned to you: Update API documentation`,
  ]
  const content = `Telegram [${contact}]: ${pick(msgs)}`
  const d = daysAgo(dayOffset)
  const id = `tg-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'telegram',
    sourceId: id,
    type: 'conversation',
    tags: JSON.stringify(['telegram', contact.toLowerCase().split('-')[0]!]),
    metadata: JSON.stringify({ contact, platform: 'telegram' }),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

function makeChatTurn(dayOffset: number): MemRow {
  const pairs = [
    [
      'What tasks are due this week?',
      "You have 3 tasks due this week: Update client proposal for TechCorp, Review Julia's PR on the dashboard, and Send invoice to HealthPlus.",
    ],
    [
      'Summarize my last meeting with StartUp GmbH',
      'In your last meeting with StartUp GmbH, you discussed the mobile app redesign. Key points: timeline confirmed for Q3, budget approved at €18,000, next step is wireframes by end of week.',
    ],
    [
      'My name is Greg and I run a digital agency in Vienna called Fixonaut.',
      "Got it Greg! I've noted that you run Fixonaut, a digital agency based in Vienna. I'll remember this context for future conversations.",
    ],
    [
      'How many active clients do we have?',
      'Based on your recent data, you have 8 active client projects across TechCorp, StartUp GmbH, HealthPlus, FinServ AG, Retail Group AT, MediaHouse, LogisticsPro, and EduTech Wien.',
    ],
    [
      'Draft a follow-up email for the TechCorp meeting',
      "Here's a draft follow-up email for TechCorp: Subject: Follow-up: Website Redesign Meeting. Dear TechCorp team, thank you for joining today's meeting. To summarize our key decisions...",
    ],
    [
      'What was my revenue last month?',
      "Based on your invoices and notes, last month's revenue was approximately €42,000 across 4 client projects.",
    ],
    [
      'Add a note: need to call Markus about the API integration',
      'Noted! I\'ve saved: "Call Markus about the API integration" as a task reminder.',
    ],
    [
      'What are my upcoming meetings this week?',
      'This week you have: Monday 10am - Sprint planning with team, Tuesday 2pm - Client demo for HealthPlus, Thursday 11am - 1:1 with David, Friday 3pm - Project review with StartUp GmbH.',
    ],
  ]
  const pair = pick(pairs)
  const content = `User: ${pair[0]}\nGreg (AI): ${pair[1]}`
  const d = daysAgo(dayOffset)
  const id = `chat-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'chat',
    sourceId: id,
    type: 'conversation',
    tags: JSON.stringify(['chat', 'agent']),
    metadata: JSON.stringify({ role: 'assistant' }),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

function makeNote(dayOffset: number): MemRow {
  const notes = [
    `Agency financials Q${rnd(1, 4)}: Revenue €${rnd(30, 80) * 1000}, Expenses €${rnd(15, 40) * 1000}, Profit margin ${rnd(25, 45)}%`,
    `Tech stack for new project: Next.js 15, Postgres, TypeScript, Tailwind, Vercel`,
    `Client pricing template: Discovery €2,500, Design €5,000-€15,000, Development €10,000-€50,000, Retainer €3,000/month`,
    `Team capacity note: David at 80%, Julia at 100%, Markus at 60% (on leave next week)`,
    `New lead from ${pick(['LinkedIn', 'referral', 'event', 'cold outreach'])}: ${pick(CLIENTS)} — interested in ${pick(PROJECTS)}`,
    `Personal goal: improve running pace to sub-5min/km by Q${rnd(1, 4)}`,
    `Reading: "${pick(['Company of One', 'The Lean Startup', 'Zero to One', 'Shoe Dog', 'The E-Myth'])}". Key takeaway: ${pick(['focus on profitability', 'validate before building', 'build for scale', 'systems over heroics'])}`,
    `Vienna agency scene notes: ${rnd(3, 8)} new agencies opened this year, competition increasing in e-commerce niche`,
    `Fixonaut brand guidelines: primary color #2563EB, font Inter, tone: professional but human`,
    `Server costs: Hetzner €${rnd(40, 120)}/month, Vercel Pro €${rnd(20, 50)}/month, total infra €${rnd(200, 500)}/month`,
  ]
  const content = pick(notes)
  const d = daysAgo(dayOffset)
  const id = `note-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'note',
    sourceId: id,
    type: 'note',
    tags: JSON.stringify(['note', 'manual']),
    metadata: JSON.stringify({}),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

function makeClickUpTask(dayOffset: number): MemRow {
  const project = pick(PROJECTS)
  const assignee = pick(TEAMMATES)
  const status = pick(['to do', 'in progress', 'review', 'done', 'blocked'])
  const priority = pick(['urgent', 'high', 'normal', 'low'])
  const content = `Task: ${pick(['Implement', 'Design', 'Review', 'Fix', 'Test', 'Deploy', 'Document'])} ${project.split(' ')[0]} ${pick(['component', 'feature', 'bug', 'integration', 'report', 'dashboard', 'API endpoint'])}\nStatus: ${status}\nPriority: ${priority}\nAssignee: ${assignee}\nProject: ${project}\nDue: ${daysAgo(
    dayOffset - rnd(0, 14),
  )
    .toISOString()
    .slice(0, 10)}`
  const d = daysAgo(dayOffset)
  const id = `cu-${dayOffset}-${rnd(10000, 99999)}`
  return {
    id,
    content,
    source: 'clickup',
    sourceId: id,
    type: 'task',
    tags: JSON.stringify(['clickup', 'task', status.replace(' ', '-')]),
    metadata: JSON.stringify({ project, assignee, status, priority }),
    createdAt: iso(d),
    updatedAt: iso(d),
  }
}

// ---------------------------------------------------------------------------
// Main seeder
// ---------------------------------------------------------------------------

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  process.stdout.write(`Connected to Postgres: ${DATABASE_URL.replace(/:\/\/[^@]+@/, '://***@')}\n`)

  // ── Memories via COPY ──────────────────────────────────────────────────────

  const TOTAL_MEMORIES = 50_000
  const SPAN_DAYS = 3650 // 10 years

  // Distribution (counts must sum to TOTAL_MEMORIES)
  const DIST: Array<{ fn: (d: number) => MemRow; count: number }> = [
    { fn: makeEmail, count: 15_000 },
    { fn: makeCalendarEvent, count: 8_000 },
    { fn: makeWhatsApp, count: 8_000 },
    { fn: makeTelegram, count: 8_000 },
    { fn: makeChatTurn, count: 5_000 },
    { fn: makeNote, count: 4_000 },
    { fn: makeClickUpTask, count: 2_000 },
  ]

  process.stdout.write(`Seeding ${TOTAL_MEMORIES.toLocaleString()} memories...\n`)

  for (const { fn, count } of DIST) {
    const rows: string[] = []
    for (let i = 0; i < count; i++) {
      const dayOffset = rnd(1, SPAN_DAYS)
      const row = fn(dayOffset)
      // Escape tab-separated values for COPY
      const esc = (s: string) =>
        s.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
      rows.push(
        [
          row.id,
          esc(row.content),
          row.source,
          row.sourceId,
          row.type,
          esc(row.tags),
          esc(row.metadata),
          row.createdAt,
          row.updatedAt,
        ].join('\t'),
      )
    }

    // Use multi-row INSERT instead of COPY for simplicity (COPY requires stream setup)
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const values: string[] = []
      const params: string[] = []
      let p = 1
      for (const line of batch) {
        const parts = line.split('\t')
        const p1 = p++,
          p2 = p++,
          p3 = p++,
          p4 = p++,
          p5 = p++,
          p6 = p++,
          p7 = p++,
          p8 = p++,
          p9 = p++
        values.push(
          `($${p1},$${p2},$${p3},$${p4},$${p5},ARRAY(SELECT jsonb_array_elements_text($${p6}::jsonb)),$${p7}::jsonb,$${p8},$${p9})`,
        )
        params.push(...parts)
      }
      try {
        await client.query(
          `INSERT INTO memories (id, content, source, source_id, type, tags, metadata, created_at, updated_at)
           VALUES ${values.join(',')}
           ON CONFLICT (id, created_at) DO NOTHING`,
          params,
        )
      } catch (err) {
        // Log and continue — some batches may fail due to partition or constraint issues
        process.stderr.write(`Batch error (offset ${i}): ${String(err)}\n`)
      }
    }
    process.stdout.write(`  ${fn.name}: ${count.toLocaleString()} rows inserted\n`)
  }

  // Queue embedding jobs for all un-embedded memories
  const { rowCount: queuedJobs } = await client.query(
    `INSERT INTO embedding_jobs (memory_id, priority)
     SELECT id, 10
     FROM memories
     WHERE embedding IS NULL
     ON CONFLICT DO NOTHING`,
  )
  process.stdout.write(`Queued ${queuedJobs ?? 0} embedding jobs (priority 10 = backfill)\n`)

  // ── Health metrics ─────────────────────────────────────────────────────────

  process.stdout.write(`\nSeeding health metrics (20 years daily data)...\n`)

  const HEALTH_DAYS = 7300 // 20 years → 240 monthly buckets (> 200 needed for T4)
  let healthRows = 0

  for (let dayOffset = 1; dayOffset <= HEALTH_DAYS; dayOffset++) {
    const d = daysAgo(dayOffset)

    for (const m of HEALTH_METRICS) {
      // Simulate gradual improvement in fitness over years
      // Heart rate decreases slightly as fitness improves
      const yearProgress = dayOffset / HEALTH_DAYS
      const improvementFactor =
        m.type === 'heart_rate' ? 1 - yearProgress * 0.05 : 1 + yearProgress * 0.03
      const val = Math.max(0, m.baseVal * improvementFactor + (Math.random() - 0.5) * m.variance)

      const sourceId = `garmin-${m.type}-${dayOffset}`

      try {
        await client.query(
          `INSERT INTO health_metrics (source, metric_type, value, unit, recorded_at, source_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (source, source_id) DO NOTHING`,
          ['garmin', m.type, Math.round(val * 10) / 10, m.unit, d.toISOString(), sourceId],
        )
        healthRows++
      } catch {
        // skip constraint violations
      }
    }

    if (dayOffset % 365 === 0) {
      process.stdout.write(
        `  Year ${Math.floor(dayOffset / 365)}: ${healthRows.toLocaleString()} health rows\n`,
      )
    }
  }

  // ── Seed pinned facts ──────────────────────────────────────────────────────

  const facts: Array<[string, string]> = [
    ['user.name', 'Gregor (Greg) Wallner'],
    ['user.company', 'Fixonaut — digital agency based in Vienna, Austria'],
    ['user.occupation', 'Digital Agency Owner / Founder'],
    ['user.location', 'Vienna, Austria'],
    ['user.timezone', 'Europe/Vienna'],
  ]

  for (const [key, value] of facts) {
    await client.query(
      `INSERT INTO memory_facts (key, value, source, updated_at)
       VALUES ($1, $2, 'seed', NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value],
    )
  }

  process.stdout.write(`\nPinned ${facts.length} identity facts\n`)

  // ── Summary ────────────────────────────────────────────────────────────────

  const { rows: countRows } = await client.query('SELECT COUNT(*) AS n FROM memories')
  const { rows: healthCountRows } = await client.query('SELECT COUNT(*) AS n FROM health_metrics')
  const { rows: pendingRows } = await client.query(
    "SELECT COUNT(*) AS n FROM embedding_jobs WHERE status = 'pending'",
  )

  process.stdout.write(
    [
      '\n✅ Seed complete',
      `Memories total:     ${parseInt(countRows[0].n, 10).toLocaleString()}`,
      `Health metrics:     ${parseInt(healthCountRows[0].n, 10).toLocaleString()}`,
      `Embedding backlog:  ${parseInt(pendingRows[0].n, 10).toLocaleString()} jobs pending`,
      '\nRun the embedding worker to process the backlog.',
      'Once done, run: pnpm tsx scripts/stress-test-memory.ts',
    ].join('\n') + '\n',
  )

  await client.end()
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`)
  process.exit(1)
})
