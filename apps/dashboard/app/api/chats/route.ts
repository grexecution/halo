import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

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

interface ChatSession {
  id: string
  title: string
  messages: Array<{ id: string; role: string; content: string; timestamp: string }>
}

function getDataDir(): string {
  return resolve(homedir(), '.open-greg')
}

function getChatsDir(): string {
  return resolve(getDataDir(), 'chats')
}

function ensureChatsDir(): void {
  const dir = getChatsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getIndexPath(): string {
  return resolve(getChatsDir(), 'index.json')
}

function readIndex(): ChatIndex {
  const path = getIndexPath()
  if (!existsSync(path)) return { sessions: [] }
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as ChatIndex
  } catch {
    return { sessions: [] }
  }
}

function writeIndex(index: ChatIndex): void {
  ensureChatsDir()
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2), 'utf-8')
}

export async function GET() {
  try {
    const index = readIndex()
    return NextResponse.json(index)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read chats: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { title?: string }
    const id = `chat-${Date.now()}`
    const now = new Date().toISOString()
    const title = body.title?.trim() || 'New Chat'

    ensureChatsDir()

    const session: ChatSession = { id, title, messages: [] }
    writeFileSync(resolve(getChatsDir(), `${id}.json`), JSON.stringify(session, null, 2), 'utf-8')

    const index = readIndex()
    const meta: ChatSessionMeta = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }
    index.sessions.unshift(meta)
    writeIndex(index)

    return NextResponse.json({ id, title, createdAt: now }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create chat: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
