export const dynamic = 'force-dynamic'
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '../../../lib/db'
import { randomUUID } from 'node:crypto'

interface NoteRow {
  id: string
  title: string
  content: string
  pinned: number
  created_at: string
  updated_at: string
}

function rowToNote(r: NoteRow) {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    pinned: r.pinned === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function GET() {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM you_notes ORDER BY pinned DESC, updated_at DESC')
    .all() as NoteRow[]
  return NextResponse.json({ notes: rows.map(rowToNote) })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { title?: string; content?: string; pinned?: boolean }
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO you_notes (id, title, content, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, body.title ?? 'Untitled', body.content ?? '', body.pinned ? 1 : 0, now, now)
  const row = db.prepare('SELECT * FROM you_notes WHERE id = ?').get(id) as NoteRow
  return NextResponse.json({ note: rowToNote(row) }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as {
    id: string
    title?: string
    content?: string
    pinned?: boolean
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE you_notes SET title = ?, content = ?, pinned = ?, updated_at = ? WHERE id = ?`,
  ).run(body.title ?? '', body.content ?? '', body.pinned ? 1 : 0, now, body.id)
  const row = db.prepare('SELECT * FROM you_notes WHERE id = ?').get(body.id) as NoteRow | undefined
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ note: rowToNote(row) })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = getDb()
  db.prepare('DELETE FROM you_notes WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
