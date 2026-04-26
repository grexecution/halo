export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

/** Per-provider credentials: { google: { id, secret }, slack: { id, secret }, ... } */
export type OAuthApps = Record<string, { id: string; secret: string }>

function readOAuthApps(): OAuthApps {
  const db = getDb()
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined
  if (!row) return {}
  try {
    const parsed = JSON.parse(row.data) as Record<string, unknown>
    return (parsed['oauth_apps'] as OAuthApps) ?? {}
  } catch {
    return {}
  }
}

export function writeOAuthApps(apps: OAuthApps): void {
  const db = getDb()
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined
  const current = row ? (JSON.parse(row.data) as Record<string, unknown>) : {}
  current['oauth_apps'] = apps
  db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(
    JSON.stringify(current),
  )
}

export async function GET() {
  return NextResponse.json(readOAuthApps())
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OAuthApps
    writeOAuthApps(body)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
