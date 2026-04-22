import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

interface LLMModel {
  id: string
  provider: 'ollama' | 'anthropic' | 'openai' | 'custom'
  name: string
  modelId: string
  apiKey?: string
  baseUrl?: string
}

interface Settings {
  llm: {
    primary: string
    models: LLMModel[]
  }
}

interface ModelEntry {
  id: string
  name: string
  provider: string
  available: boolean
}

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'

function readConfiguredModels(): LLMModel[] {
  const path = resolve(homedir(), '.open-greg', 'settings.json')
  if (!existsSync(path)) return []
  try {
    const raw = readFileSync(path, 'utf-8')
    const settings = JSON.parse(raw) as Settings
    return settings.llm?.models ?? []
  } catch {
    return []
  }
}

export async function GET() {
  const configuredModels = readConfiguredModels()

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

  // Build the merged list: start with Ollama-discovered models, then add configured
  // models that aren't already represented, marking them unavailable if Ollama is down.
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
        available: cfg.provider !== 'ollama' ? true : ollamaReachable,
      })
    }
  }

  return NextResponse.json({ models: merged })
}
