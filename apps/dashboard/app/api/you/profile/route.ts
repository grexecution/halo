export const dynamic = 'force-dynamic'
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '../../../lib/db'

interface ProfileRow {
  about: string
  preferences: string
  goals: string
  work_context: string
  updated_at: string
}

function readProfile(): ProfileRow {
  const db = getDb()
  const row = db
    .prepare(
      'SELECT about, preferences, goals, work_context, updated_at FROM you_profile WHERE id = 1',
    )
    .get() as ProfileRow | undefined
  return row ?? { about: '', preferences: '', goals: '', work_context: '', updated_at: '' }
}

export function GET() {
  const p = readProfile()
  return NextResponse.json({
    about: p.about,
    preferences: p.preferences,
    goals: p.goals,
    workContext: p.work_context,
    updatedAt: p.updated_at,
  })
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as {
    about?: string
    preferences?: string
    goals?: string
    workContext?: string
  }
  const db = getDb()
  db.prepare(
    `INSERT INTO you_profile (id, about, preferences, goals, work_context, updated_at)
     VALUES (1, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       about = excluded.about,
       preferences = excluded.preferences,
       goals = excluded.goals,
       work_context = excluded.work_context,
       updated_at = excluded.updated_at`,
  ).run(body.about ?? '', body.preferences ?? '', body.goals ?? '', body.workContext ?? '')
  return NextResponse.json({ ok: true })
}
