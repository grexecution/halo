export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'
import { getMemory } from '../../lib/memory'

interface ChatRow {
  id: string
  title: string
  agent_id: string
  created_at: string
  updated_at: string
}

export async function GET() {
  try {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT c.id, c.title, c.agent_id, c.created_at, c.updated_at,
                COUNT(m.id) AS message_count
         FROM chats c
         LEFT JOIN chat_messages m ON m.chat_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC`,
      )
      .all() as (ChatRow & { message_count: number })[]

    const sessions = rows.map((r) => ({
      id: r.id,
      title: r.title,
      agentId: r.agent_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      messageCount: r.message_count,
    }))
    return NextResponse.json({ sessions })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read chats: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { title?: string; agentId?: string }
    const id = `chat-${Date.now()}`
    const now = new Date().toISOString()
    const title = body.title?.trim() || 'New Chat'
    const agentId = body.agentId ?? 'greg'

    const db = getDb()
    db.prepare(
      'INSERT INTO chats (id, title, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, title, agentId, now, now)

    // Register thread in Mastra memory for semantic recall (fire-and-forget)
    void getMemory()
      .saveThread({
        thread: {
          id,
          title,
          resourceId: 'user',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
      })
      .catch(() => null)

    return NextResponse.json({ id, title, agentId, createdAt: now }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
