import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

interface ChatMessage {
  id: string
  role: string
  content: string
  timestamp: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
}

interface ChatSessionMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface ChatIndex {
  sessions: ChatSessionMeta[]
}

function getChatsDir(): string {
  return resolve(homedir(), '.open-greg', 'chats')
}

function ensureChatsDir(): void {
  const dir = getChatsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getChatPath(id: string): string {
  return resolve(getChatsDir(), `${id}.json`)
}

function getIndexPath(): string {
  return resolve(getChatsDir(), 'index.json')
}

function readIndex(): ChatIndex {
  const path = getIndexPath()
  if (!existsSync(path)) return { sessions: [] }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ChatIndex
  } catch {
    return { sessions: [] }
  }
}

function writeIndex(index: ChatIndex): void {
  ensureChatsDir()
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2), 'utf-8')
}

function readChat(id: string): ChatSession | null {
  const path = getChatPath(id)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ChatSession
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const chat = readChat(id)
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
    return NextResponse.json(chat)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const path = getChatPath(id)
    if (!existsSync(path)) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
    unlinkSync(path)

    const index = readIndex()
    index.sessions = index.sessions.filter((s) => s.id !== id)
    writeIndex(index)

    return NextResponse.json({ ok: true })
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
    const path = getChatPath(id)
    if (!existsSync(path)) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const chat = readChat(id)
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }
    chat.title = body.title
    writeFileSync(path, JSON.stringify(chat, null, 2), 'utf-8')

    const now = new Date().toISOString()
    const index = readIndex()
    const entry = index.sessions.find((s) => s.id === id)
    if (entry) {
      entry.title = body.title
      entry.updatedAt = now
      writeIndex(index)
    }

    return NextResponse.json({ id, title: body.title })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to update chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
