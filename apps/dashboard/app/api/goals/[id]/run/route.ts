export const dynamic = 'force-dynamic'
/**
 * POST /api/goals/[id]/run
 * Dispatches a goal to the control-plane as a DBOS durable workflow.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getGoal, updateGoal } from '../../store'
import { CONTROL_PLANE_URL } from '../../../../lib/env'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = getGoal(id)
  if (!row) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const now = new Date().toISOString()
  updateGoal(id, { status: 'running', lastRunAt: now })

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
      updateGoal(id, { status: 'failed' })
      return NextResponse.json(
        { error: `Control-plane error: ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data = (await resp.json()) as { workflowId?: string }
    return NextResponse.json({ ok: true, workflowId: data.workflowId })
  } catch (e) {
    updateGoal(id, { status: 'failed' })
    return NextResponse.json(
      { error: `Failed to dispatch goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }
}
