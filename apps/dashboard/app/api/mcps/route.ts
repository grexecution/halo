import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

interface McpRow {
  id: string
  catalog_id: string | null
  name: string
  package: string | null
  url: string | null
  transport: string
  env: string
  args: string
  status: string
  installed_at: string
  last_started_at: string | null
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM mcp_servers ORDER BY installed_at DESC').all() as McpRow[]
  return NextResponse.json({
    mcps: rows.map((r) => ({
      ...r,
      env: JSON.parse(r.env) as Record<string, string>,
      args: JSON.parse(r.args) as string[],
    })),
  })
}
