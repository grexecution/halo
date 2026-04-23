export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_DEFAULT_MODEL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_URL,
} from '../../lib/env'
import { getOllamaModels } from '../../lib/ollama'

const LLM_PROVIDER = process.env['LLM_PROVIDER'] ?? (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama')

export async function GET() {
  if (LLM_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
    return NextResponse.json({ provider: 'anthropic', model: ANTHROPIC_DEFAULT_MODEL, ready: true })
  }

  const models = await getOllamaModels(2000)
  if (models.length === 0) {
    return NextResponse.json({
      provider: 'ollama',
      model: OLLAMA_DEFAULT_MODEL,
      ready: false,
      error: `Cannot reach Ollama at ${OLLAMA_URL}. Run: ollama serve`,
    })
  }

  const modelAvailable = models.some((m) => m.name.startsWith(OLLAMA_DEFAULT_MODEL))
  if (!modelAvailable) {
    return NextResponse.json({
      provider: 'ollama',
      model: OLLAMA_DEFAULT_MODEL,
      ready: false,
      error: `Model "${OLLAMA_DEFAULT_MODEL}" not pulled yet. Run: ollama pull ${OLLAMA_DEFAULT_MODEL}`,
      availableModels: models.map((m) => m.name),
    })
  }

  return NextResponse.json({ provider: 'ollama', model: OLLAMA_DEFAULT_MODEL, ready: true })
}
