/**
 * POST /api/chat
 *
 * Routes chat messages through the control-plane (Mastra agent + durable memory).
 * Falls back to direct Ollama if the control-plane is unavailable.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const CONTROL_PLANE_URL = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    message?: string
    history?: Array<{ role: string; content: string; timestamp?: string }>
    threadId?: string
    resourceId?: string
  }

  if (!body.message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  // Try the control-plane first
  try {
    const resp = await fetch(`${CONTROL_PLANE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: body.message,
        history: body.history ?? [],
        threadId: body.threadId,
        resourceId: body.resourceId ?? 'user',
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (resp.ok) {
      const data = (await resp.json()) as {
        content?: string
        toolCalls?: unknown[]
        error?: string
      }
      if (data.error) {
        return NextResponse.json({ error: data.error }, { status: 502 })
      }
      return NextResponse.json({ content: data.content ?? '' })
    }
  } catch {
    // Control-plane unreachable — fall through to Ollama fallback
    // Control-plane unreachable — fall through to Ollama fallback
  }

  // Fallback: direct Ollama call (no memory, no tools)
  return ollamaFallback(body.message, body.history ?? [])
}

async function ollamaFallback(
  message: string,
  history: Array<{ role: string; content: string }>,
): Promise<NextResponse> {
  try {
    const model = await resolveOllamaModel()
    const messages = [...history, { role: 'user', content: message }]

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Ollama error (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data = (await res.json()) as { message?: { content: string } }
    return NextResponse.json({ content: data.message?.content ?? '(no response)' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: `Control-plane and Ollama both unavailable. (${msg})` },
      { status: 503 },
    )
  }
}

async function resolveOllamaModel(): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return OLLAMA_MODEL
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const models = data.models ?? []
    if (models.some((m) => m.name === OLLAMA_MODEL)) return OLLAMA_MODEL
    const prefixMatch = models.find((m) => m.name.startsWith(OLLAMA_MODEL + ':'))
    if (prefixMatch) return prefixMatch.name
    if (models.length > 0) return models[0]!.name
  } catch {
    /* ignore */
  }
  return OLLAMA_MODEL
}
