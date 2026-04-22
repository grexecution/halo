import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY']
const LLM_PROVIDER = process.env['LLM_PROVIDER'] ?? (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')

export async function POST(req: NextRequest) {
  const { message, history = [] } = (await req.json()) as {
    message: string
    history?: Array<{ role: string; content: string }>
  }

  if (LLM_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
    return callAnthropic(message, history)
  }

  return callOllama(message, history)
}

async function resolveOllamaModel(): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) return OLLAMA_MODEL
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const models = data.models ?? []
    // Exact match first
    if (models.some((m) => m.name === OLLAMA_MODEL)) return OLLAMA_MODEL
    // Prefix match (e.g. "llama3.2" → "llama3.2:1b")
    const prefixMatch = models.find((m) => m.name.startsWith(OLLAMA_MODEL + ':'))
    if (prefixMatch) return prefixMatch.name
    // Fall back to first available model
    if (models.length > 0) return models[0]!.name
  } catch {
    /* ignore, will fail at chat time with a useful error */
  }
  return OLLAMA_MODEL
}

async function callOllama(
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
      { error: `Could not reach Ollama at ${OLLAMA_URL}. Is it running? (${msg})` },
      { status: 503 },
    )
  }
}

async function callAnthropic(
  message: string,
  history: Array<{ role: string; content: string }>,
): Promise<NextResponse> {
  try {
    const messages = [...history, { role: 'user', content: message }]
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
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Anthropic error: ${text.slice(0, 200)}` }, { status: 502 })
    }

    const data = (await res.json()) as { content?: Array<{ text: string }> }
    const content = data.content?.[0]?.text ?? '(no response)'
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json(
      { error: `Anthropic call failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 503 },
    )
  }
}
