import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    const row = db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as DbRow | undefined
    if (!row) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    return NextResponse.json(toCron(row))
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      name?: string
      schedule?: string
      active?: boolean
      goal?: string
      command?: string
    }
    const db = getDb()
    const existing = db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as DbRow | undefined
    if (!existing) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    db.prepare('UPDATE crons SET name=?, schedule=?, active=?, goal=?, command=? WHERE id=?').run(
      body.name ?? existing.name,
      body.schedule ?? existing.schedule,
      body.active !== undefined ? (body.active ? 1 : 0) : existing.active,
      body.goal !== undefined ? body.goal : existing.goal,
      body.command !== undefined ? body.command : existing.command,
      id,
    )
    const updated = db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as DbRow
    return NextResponse.json(toCron(updated))
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to update cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    const result = db.prepare('DELETE FROM crons WHERE id = ?').run(id)
    if (result.changes === 0)
      return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to delete cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
