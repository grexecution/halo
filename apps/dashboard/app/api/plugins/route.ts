import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT plugin_id FROM plugin_credentials').all() as {
    plugin_id: string
  }[]
  const connected = rows.map((r) => r.plugin_id)
  return NextResponse.json({ connected })
}

export async function DELETE() {
  const db = getDb()
  db.prepare('DELETE FROM plugin_credentials').run()
  return NextResponse.json({ ok: true })
}
