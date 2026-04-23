import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action } = (await req.json()) as { action: 'approve' | 'deny' }
  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.json({ error: 'action must be approve or deny' }, { status: 400 })
  }

  const db = getDb()
  const status = action === 'approve' ? 'approved' : 'denied'
  const result = db
    .prepare(
      `UPDATE approvals SET status = ?, resolved_at = datetime('now'), resolved_by = 'user'
       WHERE id = ? AND status = 'pending'`,
    )
    .run(status, id)

  if (result.changes === 0) {
    return NextResponse.json({ error: 'Approval not found or already resolved' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, status })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM approvals WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
