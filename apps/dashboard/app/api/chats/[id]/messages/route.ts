/**
 * POST /api/chats/[id]/messages
 *
 * Appends a user message, streams the response back as text/event-stream SSE.
 *
 * SSE event format (mirrors control-plane):
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"tool","name":"...","args":{...}}
 *   data: {"type":"done","toolCalls":[...]}
 *   data: {"type":"error","message":"..."}
 *
 * Falls back to direct Anthropic/Ollama (non-streaming) if control-plane unavailable.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../../lib/db'
import { getActiveWorkspaces } from '../../../workspaces/store'
import { upsertMemory } from '../../../memory/store'
import { getMemory } from '../../../../lib/memory'
import { AGENT_ACTIONS_PROMPT, parseAgentActions } from '../../agent-utils'
import { CONTROL_PLANE_URL, ANTHROPIC_API_KEY, ANTHROPIC_DEFAULT_MODEL } from '../../../../lib/env'
import { callOllama, callAnthropic } from '../../../../lib/ollama'
import { generateId } from '../../../../lib/utils'

const LLM_PROVIDER = process.env['LLM_PROVIDER'] ?? (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')

interface MessageRow {
  id: string
  role: string
  content: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Route handler — returns SSE stream
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { message: string; model?: string }
  const db = getDb()

  const chat = db.prepare('SELECT id, title FROM chats WHERE id = ?').get(id) as
    | { id: string; title: string }
    | undefined
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

  const now = new Date().toISOString()
  const userMsgId = generateId('msg-user')

  db.prepare(
    'INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userMsgId, id, 'user', body.message, now)

  const priorMessages = db
    .prepare(
      'SELECT role, content FROM chat_messages WHERE chat_id = ? AND id != ? ORDER BY created_at ASC',
    )
    .all(id, userMsgId) as MessageRow[]

  // Build system context
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
    .getContext({ threadId: id, resourceId: 'user' })
    .catch(() => null)
  if (ctx?.systemMessage) systemParts.push(`### Memory & Working Context\n\n${ctx.systemMessage}`)
  if (ctx?.otherThreadsContext)
    systemParts.push(`### Related Context\n\n${ctx.otherThreadsContext}`)
  systemParts.push(AGENT_ACTIONS_PROMPT)

  const historyForLLM: Array<{ role: string; content: string }> = []
  if (systemParts.length > 0) {
    historyForLLM.push({ role: 'system', content: systemParts.join('\n\n---\n\n') })
  }
  historyForLLM.push(...priorMessages.map(({ role, content }) => ({ role, content })))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      let assistantContent = ''
      const assistantMsgId = generateId('msg-assistant')

      try {
        // --- Try control-plane streaming ---
        const cpRes = await fetch(`${CONTROL_PLANE_URL}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: body.message,
            history: historyForLLM,
            threadId: id,
            resourceId: 'user',
          }),
          signal: AbortSignal.timeout(120_000),
        })

        if (!cpRes.ok || !cpRes.body) throw new Error(`control-plane ${cpRes.status}`)

        // Forward SSE events from control-plane to browser
        const reader = cpRes.body.getReader()
        const dec = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue
            try {
              const evt = JSON.parse(raw) as {
                type: string
                text?: string
                name?: string
                args?: unknown
                toolCalls?: unknown[]
                message?: string
              }
              if (evt.type === 'chunk' && evt.text) {
                assistantContent += evt.text
                send({ type: 'chunk', text: evt.text })
              } else if (evt.type === 'tool') {
                send({ type: 'tool', name: evt.name, args: evt.args })
              } else if (evt.type === 'done') {
                // fall through to persist below
              } else if (evt.type === 'error') {
                send({ type: 'error', message: evt.message })
              }
            } catch {
              // malformed SSE line — ignore
            }
          }
        }
      } catch {
        // --- Fallback: direct LLM call (non-streaming) ---
        const msgs = [...historyForLLM, { role: 'user', content: body.message }]
        try {
          if (LLM_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
            assistantContent = await callAnthropic(msgs, ANTHROPIC_API_KEY, ANTHROPIC_DEFAULT_MODEL)
          } else {
            assistantContent = await callOllama(msgs, body.model)
          }
          // Emit full content as a single chunk so the UI gets something
          send({ type: 'chunk', text: assistantContent })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          send({ type: 'error', message: `LLM call failed: ${msg}` })
          assistantContent = `Error: ${msg}`
        }
      }

      // Persist assistant message
      const assistantAt = new Date().toISOString()
      db.prepare(
        'INSERT INTO chat_messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(assistantMsgId, id, 'assistant', assistantContent, assistantAt)
      db.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(assistantAt, id)

      // Index to memory stores (best effort)
      void upsertMemory({
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

      void getMemory()
        .saveMessages({
          messages: [
            {
              id: userMsgId,
              role: 'user',
              createdAt: new Date(now),
              threadId: id,
              resourceId: 'user',
              content: { format: 2, parts: [{ type: 'text', text: body.message }] },
            },
            {
              id: assistantMsgId,
              role: 'assistant',
              createdAt: new Date(assistantAt),
              threadId: id,
              resourceId: 'user',
              content: { format: 2, parts: [{ type: 'text', text: assistantContent }] },
            },
          ],
        })
        .catch(() => {
          /* best effort */
        })

      const pendingActions = parseAgentActions(assistantContent)
      send({
        type: 'done',
        msgId: assistantMsgId,
        timestamp: assistantAt,
        pendingActions,
      })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
