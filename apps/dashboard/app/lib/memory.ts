import { Memory } from '@mastra/memory'
import { LibSQLStore, LibSQLVector } from '@mastra/libsql'
import { fastembed } from '@mastra/fastembed'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync } from 'node:fs'
import { readSettings } from '../api/settings/store'
import type { LLMModel } from '../api/settings/store'

const DIR = join(homedir(), '.open-greg')
const MEMORY_DB_URL = `file:${join(DIR, 'memory.db')}`

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

const WORKING_MEMORY_TEMPLATE = `
# User Profile
- Name/handle: {{name}}
- Technical level: {{level}}
- Preferred communication style: {{style}}

# Ongoing Tasks & Goals
{{tasks}}

# Key Decisions & Facts
{{facts}}

# Active Projects & Workspaces
{{workspaces}}

# Preferences & Constraints
{{preferences}}
`.trim()

function buildModelFromConfig(m: LLMModel) {
  if (m.provider === 'anthropic') {
    const key = m.apiKey || process.env['ANTHROPIC_API_KEY'] || ''
    return createAnthropic({ apiKey: key })(
      m.modelId as Parameters<ReturnType<typeof createAnthropic>>[0],
    )
  }
  const baseURL =
    m.baseUrl ||
    (m.provider === 'ollama' ? `${process.env['OLLAMA_URL'] ?? 'http://localhost:11434'}/v1` : '')
  const apiKey = m.apiKey || (m.provider === 'ollama' ? 'ollama' : '')
  return createOpenAI({ ...(baseURL ? { baseURL } : {}), ...(apiKey ? { apiKey } : {}) }).chat(
    m.modelId,
  )
}

function resolveObservationModel(
  observationModelId: string,
  fallbackModelId: string | undefined,
  models: LLMModel[],
) {
  // 'disabled' — no ObservationalMemory
  if (observationModelId === 'disabled') return undefined

  // Named model from llm.models
  if (observationModelId !== 'auto') {
    const found = models.find((m) => m.id === observationModelId)
    if (found) {
      const primary = buildModelFromConfig(found)
      const fallback = fallbackModelId ? models.find((m) => m.id === fallbackModelId) : undefined
      // Return primary; fallback is handled by returning undefined if build fails
      void fallback
      return primary
    }
  }

  // 'auto': Anthropic haiku if key set, else Ollama
  const anthropicKey = process.env['ANTHROPIC_API_KEY']
  if (anthropicKey) {
    return createAnthropic({ apiKey: anthropicKey })('claude-haiku-4-5-20251001')
  }
  const ollamaUrl = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
  const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
  return createOpenAI({ baseURL: `${ollamaUrl}/v1`, apiKey: 'ollama' }).chat(ollamaModel)
}

let _memory: Memory | null = null

/** Call after settings change to force a rebuild on next getMemory() call. */
export function resetMemory() {
  _memory = null
}

export function getMemory(): Memory {
  if (_memory) return _memory
  ensureDir()

  const settings = readSettings()
  const { observationModelId, fallbackModelId } = settings.memory
  const omModel = resolveObservationModel(observationModelId, fallbackModelId, settings.llm.models)

  const storage = new LibSQLStore({ id: 'og-memory-store', url: MEMORY_DB_URL })
  const vector = new LibSQLVector({ id: 'og-memory-vector', url: MEMORY_DB_URL })

  _memory = new Memory({
    storage,
    vector,
    embedder: fastembed.base,
    options: {
      lastMessages: 40,
      semanticRecall: { topK: 15, messageRange: 3 },
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: WORKING_MEMORY_TEMPLATE,
      },
      ...(omModel
        ? {
            observationalMemory: {
              model: omModel,
              observation: { messageTokens: 20000 },
            },
          }
        : {}),
    },
  })
  return _memory
}
