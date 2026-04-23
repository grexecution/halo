import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM knowledge_docs WHERE id = ?').run(id)
  db.prepare("DELETE FROM memories WHERE source = 'knowledge' AND source_id = ?").run(id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { title?: string; tags?: string[] }
  const db = getDb()
  if (body.title)
    db.prepare(
      "UPDATE knowledge_docs SET title = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(body.title, id)
  if (body.tags)
    db.prepare("UPDATE knowledge_docs SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(
      JSON.stringify(body.tags),
      id,
    )
  return NextResponse.json({ ok: true })
}
