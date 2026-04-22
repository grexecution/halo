import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import { randomUUID } from 'node:crypto'

interface SkillBody {
  name: string
  description?: string
  category?: string
  tags?: string[]
  systemPrompt: string
  steps?: { title: string; prompt: string }[]
  exampleTrigger?: string
  docsUrl?: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as SkillBody
  if (!body.name || !body.systemPrompt) {
    return NextResponse.json({ error: 'name and systemPrompt required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const rowId = id === 'new' ? randomUUID() : id

  db.prepare(
    `
    INSERT INTO skills (id, name, description, category, tags, system_prompt, steps, example_trigger, docs_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      tags = excluded.tags,
      system_prompt = excluded.system_prompt,
      steps = excluded.steps,
      example_trigger = excluded.example_trigger,
      docs_url = excluded.docs_url,
      updated_at = excluded.updated_at
  `,
  ).run(
    rowId,
    body.name,
    body.description ?? '',
    body.category ?? 'productivity',
    JSON.stringify(body.tags ?? []),
    body.systemPrompt,
    JSON.stringify(body.steps ?? []),
    body.exampleTrigger ?? '',
    body.docsUrl ?? '',
    now,
    now,
  )

  return NextResponse.json({ ok: true, id: rowId })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM skills WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
