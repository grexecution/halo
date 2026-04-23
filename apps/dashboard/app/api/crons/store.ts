import { getDb } from '../../lib/db'
import { generateId } from '../../lib/utils'

export interface CronJob {
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

interface CronDbRow {
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

export function toCron(r: CronDbRow): CronJob {
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

export function listCrons(): CronJob[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM crons ORDER BY created_at DESC').all() as CronDbRow[]
  return rows.map(toCron)
}

export function getCron(id: string): CronJob | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as CronDbRow | undefined
  return row ? toCron(row) : null
}

export function createCron(data: {
  name: string
  schedule: string
  goal?: string
  command?: string
}): CronJob {
  const now = new Date().toISOString()
  const job: CronJob = {
    id: generateId('cron'),
    name: data.name,
    schedule: data.schedule,
    ...(data.goal !== undefined ? { goal: data.goal } : {}),
    ...(data.command !== undefined ? { command: data.command } : {}),
    active: true,
    createdAt: now,
    runCount: 0,
  }
  const db = getDb()
  db.prepare(
    'INSERT INTO crons (id, name, schedule, goal, command, active, created_at, run_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(job.id, job.name, job.schedule, job.goal ?? null, job.command ?? null, 1, job.createdAt, 0)
  return job
}

export function updateCron(
  id: string,
  patch: { name?: string; schedule?: string; active?: boolean; goal?: string; command?: string },
): CronJob | null {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as CronDbRow | undefined
  if (!existing) return null
  db.prepare('UPDATE crons SET name=?, schedule=?, active=?, goal=?, command=? WHERE id=?').run(
    patch.name ?? existing.name,
    patch.schedule ?? existing.schedule,
    patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active,
    patch.goal !== undefined ? patch.goal : existing.goal,
    patch.command !== undefined ? patch.command : existing.command,
    id,
  )
  return toCron(db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as CronDbRow)
}

export function deleteCron(id: string): boolean {
  const db = getDb()
  return db.prepare('DELETE FROM crons WHERE id = ?').run(id).changes > 0
}
