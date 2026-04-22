/**
 * POST /api/crons/[id]/run
 *
 * Manually triggers a cron job as a DBOS durable workflow via the control-plane.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db'

const CONTROL_PLANE_URL = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

interface DbRow {
  id: string
  name: string
  schedule: string
  goal: string | null
  command: string | null
  active: number
  created_at: string
  last_run_at: string | null
  run_count: number
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const row = db.prepare('SELECT * FROM crons WHERE id = ?').get(id) as DbRow | undefined
  if (!row) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })

  const now = new Date().toISOString()

  // Dispatch to control-plane REST endpoint (not tRPC)
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
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json(
        { error: `Control-plane error: ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    // Update run tracking in local DB
    db.prepare('UPDATE crons SET last_run_at=?, run_count=? WHERE id=?').run(
      now,
      row.run_count + 1,
      id,
    )

    const data = (await resp.json()) as { workflowId?: string }
    return NextResponse.json({ ok: true, workflowId: data.workflowId })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to dispatch cron: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }
}
