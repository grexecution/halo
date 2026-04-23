export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'

interface ChatRow {
  id: string
  title: string
  agent_id: string
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  chat_id: string
  role: string
  content: string
  tool_calls: string | null
  created_at: string
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id) as ChatRow | undefined
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const messages = db
      .prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC')
      .all(id) as MessageRow[]

    return NextResponse.json({
      id: chat.id,
      title: chat.title,
      agentId: chat.agent_id,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
        timestamp: m.created_at,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const purge = req.nextUrl.searchParams.get('purge') === 'true'
    const db = getDb()
    const chat = db.prepare('SELECT id FROM chats WHERE id = ?').get(id)
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    if (purge) {
      db.prepare("DELETE FROM memories WHERE source = 'chat' AND source_id = ?").run(id)
    }
    // chat_messages deleted via ON DELETE CASCADE
    db.prepare('DELETE FROM chats WHERE id = ?').run(id)
    return NextResponse.json({ ok: true, purged: purge })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to delete chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as { title: string }
    const db = getDb()
    const chat = db.prepare('SELECT id FROM chats WHERE id = ?').get(id)
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const now = new Date().toISOString()
    db.prepare('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?').run(body.title, now, id)
    return NextResponse.json({ id, title: body.title })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to update chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
