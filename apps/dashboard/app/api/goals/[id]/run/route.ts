/**
 * POST /api/goals/[id]/run
 *
 * Dispatches a goal to the control-plane as a DBOS durable workflow.
 * Updates the goal status to 'running' immediately, then the workflow
 * handles its own completion state.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db'

const CONTROL_PLANE_URL = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as DbRow | undefined
  if (!row) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const now = new Date().toISOString()

  // Mark as running
  db.prepare('UPDATE goals SET status=?, updated_at=?, last_run_at=? WHERE id=?').run(
    'running',
    now,
    now,
    id,
  )

  // Dispatch to control-plane REST endpoint (not tRPC)
  try {
    const resp = await fetch(`${CONTROL_PLANE_URL}/api/goals/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId: row.id,
        title: row.title,
        description: row.description ?? row.title,
        priority: row.priority,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      const text = await resp.text()
      db.prepare('UPDATE goals SET status=?, updated_at=? WHERE id=?').run('failed', now, id)
      return NextResponse.json(
        { error: `Control-plane error: ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data = (await resp.json()) as { workflowId?: string }
    return NextResponse.json({ ok: true, workflowId: data.workflowId })
  } catch (e) {
    db.prepare('UPDATE goals SET status=?, updated_at=? WHERE id=?').run('failed', now, id)
    return NextResponse.json(
      { error: `Failed to dispatch goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }
}
