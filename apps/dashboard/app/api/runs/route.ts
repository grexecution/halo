import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

export interface AgentRun {
  id: string
  agentId: string
  chatId: string | null
  goalId: string | null
  trigger: string
  status: 'running' | 'completed' | 'failed' | 'aborted'
  input: string
  output: string | null
  toolCalls: Array<{ toolId: string; args: unknown; result: unknown }>
  tokenCount: number
  costUsd: number
  startedAt: string
  finishedAt: string | null
  error: string | null
  durationMs: number | null
}

interface RunRow {
  id: string
  agent_id: string
  chat_id: string | null
  goal_id: string | null
  trigger: string
  status: string
  input: string
  output: string | null
  tool_calls: string
  token_count: number
  cost_usd: number
  started_at: string
  finished_at: string | null
  error: string | null
}

function toRun(row: RunRow): AgentRun {
  const durationMs = row.finished_at
    ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
    : null
  return {
    id: row.id,
    agentId: row.agent_id,
    chatId: row.chat_id,
    goalId: row.goal_id,
    trigger: row.trigger,
    status: row.status as AgentRun['status'],
    input: row.input,
    output: row.output,
    toolCalls: JSON.parse(row.tool_calls || '[]') as AgentRun['toolCalls'],
    tokenCount: row.token_count,
    costUsd: row.cost_usd,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
    durationMs,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const agentId = searchParams.get('agentId')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
  const offset = Number(searchParams.get('offset') ?? '0')

  const db = getDb()
  const where = agentId ? 'WHERE agent_id = ?' : ''
  const args = agentId ? [agentId, limit, offset] : [limit, offset]

  const rows = db
    .prepare(`SELECT * FROM agent_runs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`)
    .all(...args) as RunRow[]

  const total = (
    db
      .prepare(`SELECT COUNT(*) as n FROM agent_runs ${where}`)
      .get(...(agentId ? [agentId] : [])) as { n: number }
  ).n

  // Aggregate stats
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(token_count) as total_tokens,
        SUM(cost_usd) as total_cost
       FROM agent_runs ${where}`,
    )
    .get(...(agentId ? [agentId] : [])) as {
    total: number
    completed: number
    failed: number
    total_tokens: number
    total_cost: number
  }

  return NextResponse.json({ runs: rows.map(toRun), total, stats })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<AgentRun>
  const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const db = getDb()
  db.prepare(
    `INSERT INTO agent_runs (id, agent_id, chat_id, goal_id, trigger, status, input, tool_calls)
     VALUES (?, ?, ?, ?, ?, 'running', ?, '[]')`,
  ).run(
    id,
    body.agentId ?? 'greg',
    body.chatId ?? null,
    body.goalId ?? null,
    body.trigger ?? 'chat',
    body.input ?? '',
  )
  return NextResponse.json({ id }, { status: 201 })
}
