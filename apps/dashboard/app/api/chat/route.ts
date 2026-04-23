export const dynamic = 'force-dynamic'
/**
 * POST /api/chat
 * Routes chat messages through the control-plane. Falls back to Ollama if unavailable.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { CONTROL_PLANE_URL } from '../../lib/env'
import { callOllama, resolveOllamaModel } from '../../lib/ollama'

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
      const data = (await resp.json()) as { content?: string; error?: string }
      if (data.error) return NextResponse.json({ error: data.error }, { status: 502 })
      return NextResponse.json({ content: data.content ?? '' })
    }
  } catch {
    // Control-plane unreachable — fall through to Ollama fallback
  }

  // Fallback: direct Ollama call (no memory, no tools)
  try {
    const model = await resolveOllamaModel()
    const messages = [...(body.history ?? []), { role: 'user', content: body.message }]
    const content = await callOllama(messages, model)
    return NextResponse.json({ content })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: `Control-plane and Ollama both unavailable. (${msg})` },
      { status: 503 },
    )
  }
}
