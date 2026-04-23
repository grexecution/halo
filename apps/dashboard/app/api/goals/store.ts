import { getDb } from '../../lib/db'
import { generateId } from '../../lib/utils'

export interface Goal {
  id: string
  title: string
  description?: string
  priority: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

interface GoalDbRow {
  id: string
  title: string
  description: string | null
  priority: number
  status: string
  created_at: string
  updated_at: string
  last_run_at: string | null
}

export function toGoal(r: GoalDbRow): Goal {
  return {
    id: r.id,
    title: r.title,
    ...(r.description ? { description: r.description } : {}),
    priority: r.priority,
    status: r.status as Goal['status'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.last_run_at ? { lastRunAt: r.last_run_at } : {}),
  }
}

export function listGoals(): Goal[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM goals ORDER BY priority DESC, created_at DESC')
    .all() as GoalDbRow[]
  return rows.map(toGoal)
}

export function getGoal(id: string): Goal | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalDbRow | undefined
  return row ? toGoal(row) : null
}

export function createGoal(data: { title: string; description?: string; priority?: number }): Goal {
  const now = new Date().toISOString()
  const goal: Goal = {
    id: generateId('goal'),
    title: data.title,
    ...(data.description !== undefined ? { description: data.description } : {}),
    priority: data.priority ?? 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  const db = getDb()
  db.prepare(
    'INSERT INTO goals (id, title, description, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    goal.id,
    goal.title,
    goal.description ?? null,
    goal.priority,
    goal.status,
    goal.createdAt,
    goal.updatedAt,
  )
  return goal
}

export function updateGoal(
  id: string,
  patch: {
    title?: string
    description?: string
    priority?: number
    status?: Goal['status']
    lastRunAt?: string
  },
): Goal | null {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalDbRow | undefined
  if (!existing) return null
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE goals SET title=?, description=?, priority=?, status=?, updated_at=?, last_run_at=? WHERE id=?',
  ).run(
    patch.title ?? existing.title,
    patch.description !== undefined ? patch.description : existing.description,
    patch.priority ?? existing.priority,
    patch.status ?? existing.status,
    now,
    patch.lastRunAt !== undefined ? patch.lastRunAt : existing.last_run_at,
    id,
  )
  return toGoal(db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalDbRow)
}

export function deleteGoal(id: string): boolean {
  const db = getDb()
  return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0
}
