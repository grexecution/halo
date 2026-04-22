import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

interface SkillRow {
  id: string
  name: string
  description: string
  category: string
  tags: string
  system_prompt: string
  steps: string
  example_trigger: string
  docs_url: string
  created_at: string
  updated_at: string
}

function parseRow(r: SkillRow) {
  return {
    ...r,
    tags: JSON.parse(r.tags) as string[],
    steps: JSON.parse(r.steps) as { title: string; prompt: string }[],
    builtin: false as const,
  }
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all() as SkillRow[]
  return NextResponse.json({ skills: rows.map(parseRow) })
}
