import { NextResponse } from 'next/server'

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY']
const LLM_PROVIDER = process.env['LLM_PROVIDER'] ?? (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')

export async function GET() {
  if (LLM_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
    return NextResponse.json({
      provider: 'anthropic',
      model: process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5-20251001',
      ready: true,
    })
  }

  // Check if Ollama is reachable
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({
        provider: 'ollama',
        model: OLLAMA_MODEL,
        ready: false,
        error: 'Ollama returned non-OK status',
      })
    }

    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const models = data.models ?? []
    const modelAvailable = models.some((m) => m.name.startsWith(OLLAMA_MODEL))

    if (!modelAvailable) {
      return NextResponse.json({
        provider: 'ollama',
        model: OLLAMA_MODEL,
        ready: false,
        error: `Model "${OLLAMA_MODEL}" not pulled yet. Run: ollama pull ${OLLAMA_MODEL}`,
        availableModels: models.map((m) => m.name),
      })
    }

    return NextResponse.json({ provider: 'ollama', model: OLLAMA_MODEL, ready: true })
  } catch {
    return NextResponse.json({
      provider: 'ollama',
      model: OLLAMA_MODEL,
      ready: false,
      error: `Cannot reach Ollama at ${OLLAMA_URL}. Run: ollama serve`,
    })
  }
}
