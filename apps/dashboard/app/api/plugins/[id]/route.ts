import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const row = db
    .prepare('SELECT plugin_id, connected_at FROM plugin_credentials WHERE plugin_id = ?')
    .get(id) as { plugin_id: string; connected_at: string } | undefined
  if (!row) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, connectedAt: row.connected_at })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { fields?: Record<string, string> }
  if (!body.fields || typeof body.fields !== 'object') {
    return NextResponse.json({ error: 'fields required' }, { status: 400 })
  }
  const connectedAt = new Date().toISOString()
  const db = getDb()
  db.prepare(
    `INSERT INTO plugin_credentials (plugin_id, fields, connected_at)
     VALUES (?, ?, ?)
     ON CONFLICT(plugin_id) DO UPDATE SET
       fields = excluded.fields,
       connected_at = excluded.connected_at`,
  ).run(id, JSON.stringify(body.fields), connectedAt)

  // Hot-reload messaging bots when a messaging plugin is (re)connected
  const MESSAGING_PLUGINS = new Set(['telegram', 'discord'])
  if (MESSAGING_PLUGINS.has(id)) {
    try {
      await fetch('http://localhost:3001/api/messaging/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: id, fields: body.fields }),
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // Control-plane may not be running — that's fine, it'll load on next start
    }
  }

  return NextResponse.json({ ok: true, connectedAt })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM plugin_credentials WHERE plugin_id = ?').run(id)
  return NextResponse.json({ ok: true })
}
