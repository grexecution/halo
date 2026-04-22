import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as DbRow | undefined
    if (!row) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    return NextResponse.json(toGoal(row))
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      title?: string
      description?: string
      priority?: number
      status?: Goal['status']
    }
    const db = getDb()
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as DbRow | undefined
    if (!existing) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    const now = new Date().toISOString()
    db.prepare(
      'UPDATE goals SET title=?, description=?, priority=?, status=?, updated_at=? WHERE id=?',
    ).run(
      body.title ?? existing.title,
      body.description !== undefined ? body.description : existing.description,
      body.priority ?? existing.priority,
      body.status ?? existing.status,
      now,
      id,
    )
    const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as DbRow
    return NextResponse.json(toGoal(updated))
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to update goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    const result = db.prepare('DELETE FROM goals WHERE id = ?').run(id)
    if (result.changes === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to delete goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
