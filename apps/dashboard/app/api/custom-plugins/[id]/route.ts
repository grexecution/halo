import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import { randomUUID } from 'node:crypto'

interface FieldSchema {
  key: string
  label: string
  type: string
  required: boolean
  placeholder?: string
}

interface CustomPluginBody {
  name: string
  description?: string
  docsUrl?: string
  usageNote?: string
  fieldsSchema?: FieldSchema[]
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as CustomPluginBody
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const db = getDb()
  const now = new Date().toISOString()
  const rowId = id === 'new' ? randomUUID() : id

  db.prepare(
    `
    INSERT INTO custom_plugins (id, name, description, docs_url, usage_note, fields_schema, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      docs_url = excluded.docs_url,
      usage_note = excluded.usage_note,
      fields_schema = excluded.fields_schema,
      updated_at = excluded.updated_at
  `,
  ).run(
    rowId,
    body.name,
    body.description ?? '',
    body.docsUrl ?? '',
    body.usageNote ?? '',
    JSON.stringify(body.fieldsSchema ?? []),
    now,
    now,
  )

  return NextResponse.json({ ok: true, id: rowId })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM custom_plugins WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
