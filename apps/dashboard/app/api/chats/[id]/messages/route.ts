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
import { getDb } from '../../../../lib/db'
import { getActiveWorkspaces } from '../../../workspaces/store'
import { upsertMemory } from '../../../memory/store'
import { getMemory } from '../../../../lib/memory'
import { AGENT_ACTIONS_PROMPT, parseAgentActions } from '../../agent-utils'

interface MessageRow {
  id: string
  role: string
  content: string
  created_at: string
}

const CONTROL_PLANE_URL = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY']
const LLM_PROVIDER = process.env['LLM_PROVIDER'] ?? (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')

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
    body: JSON.stringify({ message, history, threadId, resourceId: 'user' }),
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
    const db = getDb()

    const chat = db.prepare('SELECT id, title FROM chats WHERE id = ?').get(id) as
      | { id: string; title: string }
      | undefined
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const now = new Date().toISOString()
    const userMsgId = `msg-${Date.now()}-user`

    // Persist user message
    db.prepare(
      'INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(userMsgId, id, 'user', body.message, now)

    // Build history for context (prior messages)
    const priorMessages = db
      .prepare(
        'SELECT role, content FROM chat_messages WHERE chat_id = ? AND id != ? ORDER BY created_at ASC',
      )
      .all(id, userMsgId) as MessageRow[]

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

    const historyForLLM: Array<{ role: string; content: string }> = []
    if (systemParts.length > 0) {
      historyForLLM.push({ role: 'system', content: systemParts.join('\n\n---\n\n') })
    }
    historyForLLM.push(...priorMessages.map(({ role, content }) => ({ role, content })))

    // Call the LLM via control-plane, then fall back to direct calls
    let assistantContent: string
    try {
      assistantContent = await callControlPlane(body.message, historyForLLM, id)
    } catch {
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

    const assistantMsgId = `msg-${Date.now()}-assistant`
    const assistantAt = new Date().toISOString()

    // Persist assistant message
    db.prepare(
      'INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(assistantMsgId, id, 'assistant', assistantContent, assistantAt)

    // Update chat updated_at
    db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(assistantAt, id)

    // Index to local memory store
    await upsertMemory({
      id: `chat-${id}-${userMsgId}`,
      content: `User: ${body.message}\nAssistant: ${assistantContent}`,
      source: 'chat',
      sourceId: id,
      type: 'conversation',
      tags: [],
      metadata: { sessionId: id },
      createdAt: now,
      updatedAt: assistantAt,
    })

    // Persist to Mastra memory for semantic recall
    await getMemory()
      .saveMessages({
        messages: [
          {
            id: userMsgId,
            role: 'user',
            createdAt: new Date(now),
            threadId: id,
            resourceId: 'default',
            content: { format: 2, parts: [{ type: 'text', text: body.message }] },
          },
          {
            id: assistantMsgId,
            role: 'assistant',
            createdAt: new Date(assistantAt),
            threadId: id,
            resourceId: 'default',
            content: { format: 2, parts: [{ type: 'text', text: assistantContent }] },
          },
        ],
      })
      .catch(() => {
        /* best effort */
      })

    const assistantMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: assistantContent,
      timestamp: assistantAt,
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
