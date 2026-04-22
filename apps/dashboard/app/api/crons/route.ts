import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

interface CronJob {
  id: string
  name: string
  schedule: string
  goal?: string
  command?: string
  active: boolean
  createdAt: string
  lastRunAt?: string
  lastRunStatus?: 'success' | 'failed'
  nextRunAt?: string
  runCount: number
}

interface DbRow {
  id: string
  name: string
  schedule: string
  goal: string | null
  command: string | null
  active: number
  created_at: string
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  run_count: number
}

function toCron(r: DbRow): CronJob {
  const job: CronJob = {
    id: r.id,
    name: r.name,
    schedule: r.schedule,
    active: r.active === 1,
    createdAt: r.created_at,
    runCount: r.run_count,
  }
  if (r.goal) job.goal = r.goal
  if (r.command) job.command = r.command
  if (r.last_run_at) job.lastRunAt = r.last_run_at
  if (r.last_run_status) job.lastRunStatus = r.last_run_status as 'success' | 'failed'
  if (r.next_run_at) job.nextRunAt = r.next_run_at
  return job
}

export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM crons ORDER BY created_at DESC').all() as DbRow[]
    return NextResponse.json({ jobs: rows.map(toCron) })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read crons: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string
      schedule: string
      goal?: string
      command?: string
    }
    const now = new Date().toISOString()
    const job: CronJob = {
      id: `cron-${Date.now()}`,
      name: body.name,
      schedule: body.schedule,
      ...(body.goal !== undefined ? { goal: body.goal } : {}),
      ...(body.command !== undefined ? { command: body.command } : {}),
      active: true,
      createdAt: now,
      runCount: 0,
    }
    const db = getDb()
    db.prepare(
      'INSERT INTO crons (id, name, schedule, goal, command, active, created_at, run_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      job.id,
      job.name,
      job.schedule,
      job.goal ?? null,
      job.command ?? null,
      1,
      job.createdAt,
      0,
    )
    return NextResponse.json(job, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
