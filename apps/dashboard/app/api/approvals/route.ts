import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

export interface Approval {
  id: string
  chatId: string | null
  agentId: string
  actionType: string
  description: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

interface ApprovalRow {
  id: string
  chat_id: string | null
  agent_id: string
  action_type: string
  description: string
  payload: string
  status: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

function toApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    chatId: row.chat_id,
    agentId: row.agent_id,
    actionType: row.action_type,
    description: row.description,
    payload: JSON.parse(row.payload || '{}') as Record<string, unknown>,
    status: row.status as Approval['status'],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? 'pending'
  const db = getDb()
  const rows = db
    .prepare(`SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC LIMIT 100`)
    .all(status) as ApprovalRow[]
  return NextResponse.json({ approvals: rows.map(toApproval) })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Approval>
  if (!body.actionType || !body.description) {
    return NextResponse.json({ error: 'actionType and description required' }, { status: 400 })
  }
  const id = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const db = getDb()
  db.prepare(
    `INSERT INTO approvals (id, chat_id, agent_id, action_type, description, payload, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(
    id,
    body.chatId ?? null,
    body.agentId ?? 'greg',
    body.actionType,
    body.description,
    JSON.stringify(body.payload ?? {}),
  )
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as ApprovalRow
  return NextResponse.json(toApproval(row), { status: 201 })
}
