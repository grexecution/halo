export const dynamic = 'force-dynamic'
import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '../../../lib/db'

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const source = searchParams.get('source') ?? ''

  const db = getDb()

  // Collect events from memories, agent_runs, chats
  const events: {
    id: string
    type: string
    title: string
    body: string
    source: string
    ts: string
    meta: Record<string, unknown>
  }[] = []

  // Memories
  const memFilter = source && source !== 'memory' ? '1=0' : '1=1'
  const mems = db
    .prepare(
      `SELECT id, content, source, type, metadata, created_at
       FROM memories WHERE ${memFilter}
       ORDER BY created_at DESC LIMIT 200`,
    )
    .all() as {
    id: string
    content: string
    source: string
    type: string
    metadata: string
    created_at: string
  }[]
  for (const m of mems) {
    events.push({
      id: `mem-${m.id}`,
      type: 'memory',
      title: `Memory saved`,
      body: m.content,
      source: m.source || 'chat',
      ts: m.created_at,
      meta: { memType: m.type, ...(JSON.parse(m.metadata || '{}') as Record<string, unknown>) },
    })
  }

  // Agent runs
  if (!source || source === 'run') {
    const runs = db
      .prepare(
        `SELECT id, agent_id, trigger, status, input, output, token_count, cost_usd, started_at, finished_at, error
         FROM agent_runs ORDER BY started_at DESC LIMIT 100`,
      )
      .all() as {
      id: string
      agent_id: string
      trigger: string
      status: string
      input: string
      output: string | null
      token_count: number
      cost_usd: number
      started_at: string
      finished_at: string | null
      error: string | null
    }[]
    for (const r of runs) {
      events.push({
        id: `run-${r.id}`,
        type: 'run',
        title: `Agent ran — ${r.status}`,
        body: r.input ? r.input.slice(0, 200) : '',
        source: r.trigger,
        ts: r.started_at,
        meta: {
          agentId: r.agent_id,
          status: r.status,
          tokens: r.token_count,
          cost: r.cost_usd,
          error: r.error,
        },
      })
    }
  }

  // Chat sessions
  if (!source || source === 'chat') {
    const chats = db
      .prepare(
        `SELECT id, title, created_at, updated_at,
         (SELECT COUNT(*) FROM chat_messages WHERE chat_id = chats.id) as msg_count
         FROM chats ORDER BY updated_at DESC LIMIT 100`,
      )
      .all() as {
      id: string
      title: string
      created_at: string
      updated_at: string
      msg_count: number
    }[]
    for (const c of chats) {
      events.push({
        id: `chat-${c.id}`,
        type: 'chat',
        title: c.title || 'Conversation',
        body: `${c.msg_count} messages`,
        source: 'chat',
        ts: c.updated_at,
        meta: { chatId: c.id, msgCount: c.msg_count },
      })
    }
  }

  // Sort all events by timestamp desc
  events.sort((a, b) => (b.ts > a.ts ? 1 : -1))

  const page = events.slice(offset, offset + limit)
  return NextResponse.json({ events: page, total: events.length })
}
