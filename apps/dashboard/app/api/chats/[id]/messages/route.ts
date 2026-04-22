/**
 * POST /api/chats/[id]/messages
 *
 * Appends a user message to a chat session, calls the control-plane agent
 * (with Mastra memory), persists the response, and returns it.
 *
 * Falls back to direct Ollama if the control-plane is unavailable.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { getActiveWorkspaces } from '../../../workspaces/store'
import { upsertMemory } from '../../../memory/store'
import { getMemory } from '../../../../lib/memory'
import { AGENT_ACTIONS_PROMPT, parseAgentActions } from '../../agent-utils'

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

const CONTROL_PLANE_URL = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY']
const LLM_PROVIDER = process.env['LLM_PROVIDER'] ?? (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')

function getChatsDir(): string {
  return resolve(homedir(), '.open-greg', 'chats')
}

function ensureChatsDir(): void {
  const dir = getChatsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function getChatPath(id: string): string {
  return resolve(getChatsDir(), `${id}.json`)
}

function getIndexPath(): string {
  return resolve(getChatsDir(), 'index.json')
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
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// LLM dispatch helpers
// ---------------------------------------------------------------------------

async function callControlPlane(
  message: string,
  history: Array<{ role: string; content: string }>,
  threadId: string,
): Promise<string> {
  const resp = await fetch(`${CONTROL_PLANE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      threadId,
      resourceId: 'user',
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Control-plane error (${resp.status}): ${text.slice(0, 200)}`)
  }
  const data = (await resp.json()) as { content?: string; error?: string }
  if (data.error) throw new Error(data.error)
  return data.content ?? '(no response)'
}

async function callOllama(
  messages: Array<{ role: string; content: string }>,
  model = OLLAMA_MODEL,
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { message?: { content: string } }
  return data.message?.content ?? '(no response)'
}

async function callAnthropic(messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic error: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { content?: Array<{ text: string }> }
  return data.content?.[0]?.text ?? '(no response)'
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as { message: string; model?: string }

    ensureChatsDir()

    const chat = readChat(id)
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: body.message,
      timestamp: now,
    }
    chat.messages.push(userMessage)

    // Build system context from active workspaces + Mastra memory
    const systemParts: string[] = []

    const activeWorkspaces = getActiveWorkspaces()
    if (activeWorkspaces.length > 0) {
      const wsBlock = activeWorkspaces
        .map((ws) => {
          const lines = [`## Workspace: ${ws.name} (${ws.type})`]
          if (ws.description) lines.push(ws.description)
          for (const f of ws.fields) {
            if (f.value && f.type !== 'secret') lines.push(`${f.key}: ${f.value}`)
          }
          return lines.join('\n')
        })
        .join('\n\n')
      systemParts.push(`### Active Workspace Context\n\n${wsBlock}`)
    }

    const ctx = await getMemory()
      .getContext({ threadId: id, resourceId: 'default' })
      .catch(() => null)
    if (ctx?.systemMessage) {
      systemParts.push(`### Memory & Working Context\n\n${ctx.systemMessage}`)
    }
    if (ctx?.otherThreadsContext) {
      systemParts.push(`### Related Workspace & Project Context\n\n${ctx.otherThreadsContext}`)
    }

    systemParts.push(AGENT_ACTIONS_PROMPT)

    // Build history for the LLM (system + prior messages)
    const historyForLLM: Array<{ role: string; content: string }> = []
    if (systemParts.length > 0) {
      historyForLLM.push({ role: 'system', content: systemParts.join('\n\n---\n\n') })
    }
    historyForLLM.push(
      ...chat.messages.slice(0, -1).map(({ role, content }) => ({ role, content })),
    )

    // Call the LLM via control-plane, then fall back to direct calls
    let assistantContent: string
    try {
      assistantContent = await callControlPlane(body.message, historyForLLM, id)
    } catch {
      // Control-plane unavailable — fall back to direct LLM
      historyForLLM.push({ role: 'user', content: body.message })
      try {
        if (LLM_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
          assistantContent = await callAnthropic(historyForLLM)
        } else {
          assistantContent = await callOllama(historyForLLM, body.model ?? OLLAMA_MODEL)
        }
      } catch (e) {
        return NextResponse.json(
          { error: `LLM call failed: ${e instanceof Error ? e.message : String(e)}` },
          { status: 502 },
        )
      }
    }

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
    }
    chat.messages.push(assistantMessage)

    writeFileSync(getChatPath(id), JSON.stringify(chat, null, 2), 'utf-8')

    // Index conversation turn to local memory store
    await upsertMemory({
      id: `chat-${id}-${userMessage.id}`,
      content: `User: ${userMessage.content}\nAssistant: ${assistantContent}`,
      source: 'chat',
      sourceId: id,
      type: 'conversation',
      tags: [],
      metadata: { sessionId: id },
      createdAt: now,
      updatedAt: new Date().toISOString(),
    })

    // Also persist to Mastra memory for semantic recall in future turns
    const now2 = new Date()
    await getMemory()
      .saveMessages({
        messages: [
          {
            id: userMessage.id,
            role: 'user',
            createdAt: new Date(userMessage.timestamp),
            threadId: id,
            resourceId: 'default',
            content: { format: 2, parts: [{ type: 'text', text: userMessage.content }] },
          },
          {
            id: assistantMessage.id,
            role: 'assistant',
            createdAt: now2,
            threadId: id,
            resourceId: 'default',
            content: { format: 2, parts: [{ type: 'text', text: assistantContent }] },
          },
        ],
      })
      .catch(() => {
        /* best effort */
      })

    // Update the session index
    const index = readIndex()
    const entry = index.sessions.find((s) => s.id === id)
    if (entry) {
      entry.updatedAt = new Date().toISOString()
      entry.messageCount = chat.messages.length
      writeIndex(index)
    }

    const pendingActions = parseAgentActions(assistantContent)
    return NextResponse.json({ message: assistantMessage, pendingActions }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to process message: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
