/**
 * seed-synthetic-memories.ts
 *
 * Seeds 500+ synthetic memories spanning 2 years into the memories table.
 * Run with: npx tsx scripts/seed-synthetic-memories.ts
 *
 * This exercises the memory/embedding system as if the user had 2 years of
 * real data — emails, calendar events, WhatsApp messages, notes, and chats.
 */

import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'

const DB_PATH =
  process.env['DB_PATH'] ??
  (existsSync('/var/lib/docker/volumes/open-greg_halo_data/_data/app.db')
    ? '/var/lib/docker/volumes/open-greg_halo_data/_data/app.db'
    : '/data/app.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

const insert = db.prepare(`
  INSERT OR IGNORE INTO memories (id, content, source, source_id, type, tags, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

let count = 0

function addMemory(opts: {
  content: string
  source: 'email' | 'chat' | 'calendar' | 'whatsapp' | 'note' | 'document'
  type: 'email' | 'conversation' | 'fact' | 'document' | 'note' | 'code'
  tags: string[]
  metadata?: Record<string, string>
  daysAgoVal: number
}) {
  const id = randomUUID()
  const ts = daysAgo(opts.daysAgoVal)
  insert.run(
    id,
    opts.content,
    opts.source,
    `seed-${opts.source}`,
    opts.type,
    JSON.stringify(opts.tags),
    JSON.stringify(opts.metadata ?? {}),
    ts,
    ts,
  )
  count++
}

// ── CLIENTS ──────────────────────────────────────────────────────────────────

const clients = [
  {
    name: 'TechCorp GmbH',
    contact: 'Michael Bauer',
    budget: '€45,000',
    project: 'e-commerce redesign',
  },
  {
    name: 'StartUp Vienna',
    contact: 'Anna Müller',
    budget: '€12,000',
    project: 'MVP landing page',
  },
  {
    name: 'Retail Group AG',
    contact: 'Thomas Kiefer',
    budget: '€80,000',
    project: 'digital transformation',
  },
  { name: 'HealthPlus GmbH', contact: 'Sarah Weber', budget: '€30,000', project: 'patient portal' },
  {
    name: 'EduTech Solutions',
    contact: 'Klaus Fischer',
    budget: '€25,000',
    project: 'e-learning platform',
  },
  {
    name: 'FinTech Startup',
    contact: 'Lisa Schneider',
    budget: '€60,000',
    project: 'dashboard app',
  },
  { name: 'LocalBiz Graz', contact: 'Peter Hofmann', budget: '€8,000', project: 'website refresh' },
  {
    name: 'AutoDealer Wien',
    contact: 'Maria Gruber',
    budget: '€15,000',
    project: 'CRM integration',
  },
]

const teammates = [
  'David (Designer)',
  'Julia (Dev)',
  'Markus (SEO)',
  'Sophie (PM)',
  'Lukas (Backend)',
]
const projectStatuses = ['in progress', 'delivered', 'on hold', 'review', 'signed']

// ── EMAILS (150 entries, spanning 730 days) ───────────────────────────────────

process.stdout.write('Seeding emails...')

for (let i = 0; i < 150; i++) {
  const client = pick(clients)
  const day = randomBetween(1, 730)
  const subjects = [
    `Re: ${client.project} — feedback on mockups`,
    `Invoice #${randomBetween(1000, 9999)} — ${client.name}`,
    `Meeting recap: ${client.project} kickoff`,
    `${client.project} — revised timeline attached`,
    `Question about ${client.project} scope`,
    `URGENT: hotfix needed for ${client.project}`,
    `${client.name} — contract renewal discussion`,
    `Final delivery: ${client.project}`,
    `${client.project} — status update`,
    `New brief from ${client.contact}`,
  ]
  const subject = pick(subjects)
  const bodies = [
    `From: ${client.contact} <${client.contact.toLowerCase().replace(' ', '.')}@${client.name.toLowerCase().replace(/\s+/g, '')}.com>\nSubject: ${subject}\n\nHi Greg,\n\nThanks for the update. The client is happy with the current progress on the ${client.project}. Budget is ${client.budget}. Can we schedule a call this week?\n\nBest,\n${client.contact}`,
    `From: Greg <greg@agency.com>\nTo: ${client.contact}\nSubject: ${subject}\n\nHi ${client.contact.split(' ')[0]},\n\nAttached is the revised proposal for the ${client.project}. The scope includes all requested features within the ${client.budget} budget. Please review and let me know.\n\nBest regards,\nGreg`,
    `From: ${client.contact}\nSubject: ${subject}\n\n${client.contact} wrote: We need the ${client.project} live by end of month. Current status is ${pick(projectStatuses)}. Please confirm the deployment timeline.\n\nGreg replied: Confirmed. We're on track for the deadline. ${pick(teammates)} is handling the final QA pass.`,
  ]
  addMemory({
    content: pick(bodies),
    source: 'email',
    type: 'email',
    tags: ['email', client.name.toLowerCase().replace(/\s+/g, '-'), 'client'],
    metadata: { client: client.name, contact: client.contact, subject },
    daysAgoVal: day,
  })
}

// ── CALENDAR EVENTS (100 entries) ─────────────────────────────────────────────

process.stdout.write('Seeding calendar events...')

const eventTypes = [
  'Client call',
  'Team standup',
  'Design review',
  'Sprint planning',
  'Invoice due',
  'Contract signing',
  'Workshop',
  'Networking event',
  'Quarterly review',
  'Strategy session',
  'Demo presentation',
  'Onboarding',
]

for (let i = 0; i < 100; i++) {
  const client = pick(clients)
  const day = randomBetween(1, 730)
  const eventType = pick(eventTypes)
  const duration = pick(['30 min', '1 hour', '2 hours', '90 min'])
  const location = pick(['Zoom', 'Google Meet', 'Office Vienna', 'Client office', 'Teams'])

  addMemory({
    content: `Calendar: ${eventType} — ${client.name}\nDate: ${daysAgo(day).split('T')[0]}\nDuration: ${duration}\nLocation: ${location}\nAttendees: Greg, ${client.contact}${Math.random() > 0.5 ? ', ' + pick(teammates) : ''}\nNotes: ${eventType} for ${client.project}. Budget discussed: ${client.budget}. Status: ${pick(projectStatuses)}.`,
    source: 'calendar',
    type: 'fact',
    tags: ['calendar', 'meeting', client.name.toLowerCase().replace(/\s+/g, '-')],
    metadata: { client: client.name, eventType, location },
    daysAgoVal: day,
  })
}

// ── WHATSAPP MESSAGES (120 entries) ──────────────────────────────────────────

process.stdout.write('Seeding WhatsApp messages...')

const waContacts = [
  ...clients.map((c) => c.contact),
  ...teammates,
  'Mom',
  'Stefan (Friend)',
  'Alex (Accountant)',
  'Petra (Lawyer)',
]

const waMessages = [
  (name: string) =>
    `${name}: Hey Greg, quick update — project is on track. Sending invoice tomorrow.\nGreg: Great, thanks! Keep me posted.`,
  (name: string) =>
    `Greg: Can you send me the latest files?\n${name}: Sure, uploading now to Drive. Check the shared folder.\nGreg: Got it, looks good!`,
  (name: string) =>
    `${name}: Meeting tomorrow 10am still on?\nGreg: Yes, confirmed. Will send the agenda in 30min.\n${name}: Perfect 👍`,
  (name: string) =>
    `${name}: Invoice paid! ✅\nGreg: Received, thank you! Great working with you.\n${name}: Same here, talk soon.`,
  (name: string) =>
    `Greg: Running 10 min late for the call\n${name}: No worries, I'll start the meeting and share my screen\nGreg: Thanks, joining now`,
  () =>
    `Agency WhatsApp Group (Greg, David, Julia, Markus):\nJulia: Pushed the new feature to staging\nDavid: UI looks clean! 💪\nMarkus: SEO meta tags need updating\nGreg: Good catch Markus, please fix before deploy`,
]

for (let i = 0; i < 120; i++) {
  const contact = pick(waContacts)
  const day = randomBetween(1, 730)
  const msgFn = pick(waMessages)
  addMemory({
    content: msgFn(contact),
    source: 'whatsapp',
    type: 'conversation',
    tags: ['whatsapp', 'message', contact.toLowerCase().replace(/[\s()]/g, '-')],
    metadata: { contact, platform: 'whatsapp' },
    daysAgoVal: day,
  })
}

// ── CHAT CONVERSATIONS WITH AGENT (80 entries) ────────────────────────────────

process.stdout.write('Seeding agent chat history...')

const chatPairs = [
  [
    'Write a proposal for a new client website project',
    'Here is a professional proposal template: Executive Summary, Project Scope, Timeline, Budget breakdown, Team & Expertise, Next Steps. I have included your agency branding and the client-specific details.',
  ],
  [
    'What is the status of the TechCorp project?',
    'Based on our previous conversations, TechCorp GmbH is working on an e-commerce redesign with a €45,000 budget. The project is currently in progress with Michael Bauer as the main contact.',
  ],
  [
    'Draft a follow-up email for the overdue invoice',
    'Subject: Friendly Reminder — Invoice #4521 Overdue\n\nDear [Client],\n\nI hope this message finds you well. I wanted to follow up regarding invoice #4521 due on [date]. If you have already sent payment, please disregard this message. Otherwise, please let us know if you have any questions.\n\nBest regards,\nGreg',
  ],
  [
    "Summarize this week's meetings",
    'This week you had: Monday — StartUp Vienna kickoff (MVP landing page, €12K budget). Tuesday — TechCorp design review. Thursday — Team sprint planning with David and Julia. Friday — HealthPlus client demo.',
  ],
  [
    'What are my biggest clients by budget?',
    'Based on your data: 1. Retail Group AG — €80,000 (digital transformation), 2. FinTech Startup — €60,000 (dashboard app), 3. TechCorp GmbH — €45,000 (e-commerce redesign), 4. HealthPlus GmbH — €30,000 (patient portal).',
  ],
  [
    'Help me write a LinkedIn post about our agency',
    'Here\'s a LinkedIn post: "Excited to share that our agency just delivered a complete digital transformation for Retail Group AG 🚀 Six months of work, an amazing team, and a client who trusted us with their vision. If your business needs a digital upgrade, let\'s talk! #DigitalAgency #WebDevelopment #Vienna"',
  ],
  [
    'What tools does the team use?',
    'Based on our previous discussions, your team uses: Design — Figma, Adobe Suite. Development — VS Code, GitHub, Docker. Project Management — ClickUp. Communication — Slack, WhatsApp. Invoicing — custom system. Hosting — Vercel, Cloudflare.',
  ],
  [
    'Create a project timeline for a new e-commerce project',
    'Here is a 12-week e-commerce project timeline:\nWeek 1-2: Discovery & Requirements\nWeek 3-4: Wireframes & Design\nWeek 5-6: Development Setup & Core Features\nWeek 7-8: Frontend Development\nWeek 9-10: Backend & Integrations\nWeek 11: Testing & QA\nWeek 12: Launch & Handover',
  ],
]

for (let i = 0; i < 80; i++) {
  const [userMsg, agentMsg] = pick(chatPairs)!
  const day = randomBetween(1, 730)
  addMemory({
    content: `User: ${userMsg}\nAssistant: ${agentMsg}`,
    source: 'chat',
    type: 'conversation',
    tags: ['chat', 'agent', 'assistant'],
    metadata: { sessionId: randomUUID() },
    daysAgoVal: day,
  })
}

// ── NOTES & DOCUMENTS (80 entries) ───────────────────────────────────────────

process.stdout.write('Seeding notes and documents...')

const notes = [
  'Agency revenue goal for this year: €500,000. Currently at 68% (€340,000). Need 3 more mid-size projects to hit target.',
  'Tech stack preferences: Next.js for frontend, Node.js + Fastify backend, Postgres DB, Vercel deployment. Avoid WordPress unless client insists.',
  'Pricing model: hourly rate €120/h for development, €90/h for design, €150/h for consulting. Project min: €5,000.',
  'Team capacity: David (100%), Julia (80% — parental leave end next month), Markus (freelance — 3 days/week), Sophie (full time PM), Lukas (80%).',
  'New service offering idea: AI agent integration packages for SMBs. Estimated market: Vienna, Munich, Zurich. Price point: €8k-30k.',
  'Client acquisition channels: 70% referrals, 20% LinkedIn, 10% cold outreach. Focus on improving LinkedIn presence.',
  'Important: Retail Group AG contract renewal in 3 months. Prepare proposal for year 2 scope extension.',
  'Q3 retrospective: Delivered 8 projects on time, 2 slightly delayed. Main bottleneck: design handoffs taking too long. Solution: Figma Dev Mode rollout.',
  'Personal goal: attend 2 conferences this year (done: WebSummit Lisbon, upcoming: ViennaJS). Network goal: 50 new meaningful connections.',
  'Tax deadline: Q3 VAT return due in 3 weeks. Alex (accountant) will handle. All invoices sent to accounting@agency.com.',
]

for (let i = 0; i < 80; i++) {
  const note = i < notes.length ? notes[i]! : pick(notes)
  const day = randomBetween(1, 730)
  addMemory({
    content: note,
    source: 'note',
    type: i < 3 ? 'fact' : 'note',
    tags: ['note', 'agency', 'business'],
    metadata: { category: 'agency-notes' },
    daysAgoVal: day,
  })
}

// ── DOCUMENTS (30 entries) ────────────────────────────────────────────────────

process.stdout.write('Seeding documents...')

const docs = [
  {
    title: 'Agency Master Contract Template',
    content:
      'Standard contract terms: Payment net 14 days. Late payment: 5% penalty per month. IP transfer upon full payment. Revisions: 2 rounds included, additional at €120/h. Cancellation: 30 days notice, work completed billed.',
  },
  {
    title: 'Team Onboarding Checklist',
    content:
      'New team member onboarding: 1. GitHub access, 2. Slack workspace, 3. ClickUp account, 4. Figma team, 5. 1Password shared vault, 6. Google Workspace email, 7. Time tracking setup, 8. NDA signed, 9. GDPR training completed.',
  },
  {
    title: 'Agency Brand Guidelines',
    content:
      'Logo: Primary navy blue (#1a2b4a), Secondary gold (#c9a84c). Font: Inter for web, Neue Haas Grotesk for print. Tone: Professional, direct, results-oriented. Target audience: SMBs and startups in DACH region.',
  },
  {
    title: 'Q1 2025 Financial Summary',
    content:
      'Revenue: €127,400. Expenses: €48,200. Net profit: €79,200 (62% margin). Top client: Retail Group AG (€32k). New clients: 4. Repeat business: 6 existing clients. Outstanding invoices: €23,000.',
  },
  {
    title: 'Technology Stack Decision Log',
    content:
      'Decided to standardize on: Next.js 15 (App Router), TypeScript strict mode, Tailwind CSS, shadcn/ui components, Postgres (Neon for cloud), Vercel deployment, GitHub Actions CI/CD. Evaluated but rejected: Remix (ecosystem smaller), SvelteKit (less client demand).',
  },
]

for (let i = 0; i < 30; i++) {
  const doc = pick(docs)
  const day = randomBetween(30, 730)
  addMemory({
    content: `Document: ${doc.title}\n\n${doc.content}`,
    source: 'document' as 'note',
    type: 'document',
    tags: ['document', 'agency', 'reference'],
    metadata: { title: doc.title, type: 'document' },
    daysAgoVal: day,
  })
}

// ── DONE ─────────────────────────────────────────────────────────────────────

db.close()
process.stdout.write(
  [
    `\n✅ Seeded ${count} memories into ${DB_PATH}`,
    'Memory breakdown:',
    '  - Emails: 150',
    '  - Calendar events: 100',
    '  - WhatsApp messages: 120',
    '  - Chat conversations: 80',
    '  - Notes: 80',
    '  - Documents: 30',
    '\nTotal: 560 synthetic memories spanning 2 years\n',
  ].join('\n'),
)
