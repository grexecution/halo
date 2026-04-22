import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

interface CustomPluginRow {
  id: string
  name: string
  description: string
  docs_url: string
  usage_note: string
  fields_schema: string
  created_at: string
  updated_at: string
}

function parseRow(r: CustomPluginRow) {
  return {
    ...r,
    fieldsSchema: JSON.parse(r.fields_schema) as {
      key: string
      label: string
      type: string
      required: boolean
      placeholder?: string
    }[],
  }
}

export async function GET() {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM custom_plugins ORDER BY created_at DESC')
    .all() as CustomPluginRow[]
  return NextResponse.json({ plugins: rows.map(parseRow) })
}
