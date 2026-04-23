/**
 * POST /api/crons/[id]/run
 * Manually triggers a cron job as a DBOS durable workflow via the control-plane.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCron } from '../../store'
import { getDb } from '../../../../lib/db'
import { CONTROL_PLANE_URL } from '../../../../lib/env'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = getCron(id)
  if (!row) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })

  const now = new Date().toISOString()

  try {
    const resp = await fetch(`${CONTROL_PLANE_URL}/api/crons/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cronId: row.id,
        name: row.name,
        schedule: row.schedule,
        command: row.command ?? row.goal ?? row.name,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json(
        { error: `Control-plane error: ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    // Update run tracking in local DB
    const db = getDb()
    db.prepare('UPDATE crons SET last_run_at=?, run_count=run_count+1 WHERE id=?').run(now, id)

    const data = (await resp.json()) as { workflowId?: string }
    return NextResponse.json({ ok: true, workflowId: data.workflowId })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to dispatch cron: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }
}
