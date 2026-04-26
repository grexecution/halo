export const dynamic = 'force-dynamic'
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '../../../lib/db'

// Stores avatar as base64 data URL directly in SQLite (profile pictures are small)
// Max ~2MB after base64 encoding

export function GET() {
  const db = getDb()
  const row = db.prepare('SELECT avatar_data FROM you_profile WHERE id = 1').get() as
    | { avatar_data: string | null }
    | undefined
  return NextResponse.json({ avatarData: row?.avatar_data ?? null })
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as { avatarData?: string | null }
  const db = getDb()
  db.prepare(
    `INSERT INTO you_profile (id, avatar_data, about, preferences, goals, work_context, updated_at)
     VALUES (1, ?, '', '', '', '', datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       avatar_data = excluded.avatar_data,
       updated_at = datetime('now')`,
  ).run(body.avatarData ?? null)
  return NextResponse.json({ ok: true })
}
