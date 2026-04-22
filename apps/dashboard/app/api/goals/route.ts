import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

interface Goal {
  id: string
  title: string
  description?: string
  priority: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

interface DbRow {
  id: string
  title: string
  description: string | null
  priority: number
  status: string
  created_at: string
  updated_at: string
  last_run_at: string | null
}

function toGoal(r: DbRow): Goal {
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

export async function GET() {
  try {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM goals ORDER BY priority DESC, created_at DESC')
      .all() as DbRow[]
    return NextResponse.json({ goals: rows.map(toGoal) })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read goals: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { title: string; description?: string; priority?: number }
    const now = new Date().toISOString()
    const goal: Goal = {
      id: `goal-${Date.now()}`,
      title: body.title,
      ...(body.description !== undefined ? { description: body.description } : {}),
      priority: body.priority ?? 0,
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
    return NextResponse.json(goal, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
