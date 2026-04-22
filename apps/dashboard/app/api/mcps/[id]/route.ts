import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import { randomUUID } from 'node:crypto'

interface InstallBody {
  catalogId?: string
  name: string
  package?: string
  url?: string
  transport?: string
  env?: Record<string, string>
  args?: string[]
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as InstallBody
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const db = getDb()
  const installedAt = new Date().toISOString()
  const rowId = id === 'new' ? randomUUID() : id

  db.prepare(
    `
    INSERT INTO mcp_servers (id, catalog_id, name, package, url, transport, env, args, status, installed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stopped', ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      package = excluded.package,
      url = excluded.url,
      transport = excluded.transport,
      env = excluded.env,
      args = excluded.args
  `,
  ).run(
    rowId,
    body.catalogId ?? null,
    body.name,
    body.package ?? null,
    body.url ?? null,
    body.transport ?? 'stdio',
    JSON.stringify(body.env ?? {}),
    JSON.stringify(body.args ?? []),
    installedAt,
  )

  return NextResponse.json({ ok: true, id: rowId })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
