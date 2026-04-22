import { NextResponse } from 'next/server'
import { readSettings } from '../settings/store'

interface ModelEntry {
  id: string
  name: string
  provider: string
  available: boolean
}

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'

export async function GET() {
  // Read configured models from SQLite settings store (single source of truth)
  const settings = readSettings()
  const configuredModels = settings.llm.models

  let ollamaModels: ModelEntry[] = []
  let ollamaReachable = false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      ollamaReachable = true
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      const tags = data.models ?? []
      ollamaModels = tags.map((m) => ({
        id: `ollama-${m.name}`,
        name: m.name,
        provider: 'ollama',
        available: true,
      }))
    }
  } catch {
    // Ollama unreachable — fall through
  }

  // Merge: start with Ollama-discovered, then add configured models not already listed
  const merged: ModelEntry[] = [...ollamaModels]

  for (const cfg of configuredModels) {
    const alreadyPresent = merged.some(
      (m) => m.provider === cfg.provider && (m.id === cfg.id || m.name === cfg.modelId),
    )
    if (!alreadyPresent) {
      merged.push({
        id: cfg.id,
        name: cfg.name,
        provider: cfg.provider,
        // Non-Ollama models (Anthropic, OpenAI) are always available if configured
        available: cfg.provider !== 'ollama' ? true : ollamaReachable,
      })
    }
  }

  return NextResponse.json({ models: merged })
}
