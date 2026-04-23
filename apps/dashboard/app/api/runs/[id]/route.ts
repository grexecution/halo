export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import type { AgentRun } from '../route'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as Partial<AgentRun>
  const db = getDb()

  const fields: string[] = []
  const values: unknown[] = []

  if (body.status !== undefined) {
    fields.push('status = ?')
    values.push(body.status)
  }
  if (body.output !== undefined) {
    fields.push('output = ?')
    values.push(body.output)
  }
  if (body.tokenCount !== undefined) {
    fields.push('token_count = ?')
    values.push(body.tokenCount)
  }
  if (body.costUsd !== undefined) {
    fields.push('cost_usd = ?')
    values.push(body.costUsd)
  }
  if (body.toolCalls !== undefined) {
    fields.push('tool_calls = ?')
    values.push(JSON.stringify(body.toolCalls))
  }
  if (body.error !== undefined) {
    fields.push('error = ?')
    values.push(body.error)
  }
  if (body.status === 'completed' || body.status === 'failed' || body.status === 'aborted') {
    fields.push("finished_at = datetime('now')")
  }

  if (fields.length === 0) return NextResponse.json({ ok: true })

  values.push(id)
  db.prepare(`UPDATE agent_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return NextResponse.json({ ok: true })
}
