/**
 * Singleton Mastra instance for the control-plane.
 * Owns the Agent, Memory, and tool registry.
 */
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore, LibSQLVector } from '@mastra/libsql'
import { fastembed } from '@mastra/fastembed'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { allMastraTools } from './mastra-tools.js'

const DIR = join(homedir(), '.open-greg')
const MEMORY_DB_URL = `file:${join(DIR, 'memory.db')}`

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// Read settings.json for model config (falls back to env / hardcoded defaults)
// ---------------------------------------------------------------------------

function readSettings(): { ollamaModel?: string; anthropicModel?: string } {
  try {
    const raw = readFileSync(join(DIR, 'settings.json'), 'utf-8')
    const s = JSON.parse(raw) as { llm?: { models?: Array<{ provider: string; modelId: string }> } }
    const models = s?.llm?.models ?? []
    const ollamaEntry = models.find((m) => m.provider === 'ollama')
    const anthropicEntry = models.find((m) => m.provider === 'anthropic')
    const result: { ollamaModel?: string; anthropicModel?: string } = {}
    if (ollamaEntry?.modelId) result.ollamaModel = ollamaEntry.modelId
    if (anthropicEntry?.modelId) result.anthropicModel = anthropicEntry.modelId
    return result
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

function resolveModel() {
  const provider = process.env['LLM_PROVIDER'] ?? 'auto'
  const anthropicKey = process.env['ANTHROPIC_API_KEY']
  const settings = readSettings()

  if (provider === 'anthropic' || (provider === 'auto' && anthropicKey)) {
    const model =
      process.env['ANTHROPIC_MODEL'] ?? settings.anthropicModel ?? 'claude-haiku-4-5-20251001'
    return createAnthropic({ apiKey: anthropicKey! })(
      model as Parameters<ReturnType<typeof createAnthropic>>[0],
    )
  }

  // Ollama / OpenAI-compatible
  const ollamaUrl = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
  const ollamaModel = process.env['OLLAMA_MODEL'] ?? settings.ollamaModel ?? 'llama3.2'
  return createOpenAI({ baseURL: `${ollamaUrl}/v1`, apiKey: 'ollama' }).chat(ollamaModel)
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

function buildMemory(): Memory {
  ensureDir()
  const storage = new LibSQLStore({ id: 'og-memory-store', url: MEMORY_DB_URL })
  const vector = new LibSQLVector({ id: 'og-memory-vector', url: MEMORY_DB_URL })

  const anthropicKey = process.env['ANTHROPIC_API_KEY']
  const ollamaUrl = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
  const settings = readSettings()
  const ollamaModel = process.env['OLLAMA_MODEL'] ?? settings.ollamaModel ?? 'llama3.2'

  const omModel = anthropicKey
    ? createAnthropic({ apiKey: anthropicKey })(
        (process.env['ANTHROPIC_MODEL'] ??
          settings.anthropicModel ??
          'claude-haiku-4-5-20251001') as Parameters<ReturnType<typeof createAnthropic>>[0],
      )
    : createOpenAI({ baseURL: `${ollamaUrl}/v1`, apiKey: 'ollama' }).chat(ollamaModel)

  return new Memory({
    storage,
    vector,
    embedder: fastembed.base,
    options: {
      lastMessages: 40,
      semanticRecall: { topK: 15, messageRange: 3 },
      workingMemory: {
        enabled: true,
        scope: 'resource',
      },
      observationalMemory: {
        model: omModel,
        observation: { messageTokens: 20_000 },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are Greg, an open-source autonomous AI assistant.
You run on the user's own machine with full access to their local tools.
Be concise, accurate, and action-oriented.
When you use tools, briefly explain what you're doing and why.
Today's date and timezone will be injected into each request context.
`.trim()

let _memory: Memory | null = null
let _agent: Agent | null = null

export function getMemory(): Memory {
  if (!_memory) _memory = buildMemory()
  return _memory
}

export function getAgent(): Agent {
  if (_agent) return _agent

  _agent = new Agent({
    id: 'greg',
    name: 'Greg',
    instructions: SYSTEM_PROMPT,
    model: resolveModel(),
    tools: allMastraTools,
    memory: getMemory(),
  })

  return _agent
}

/** Reset singletons (e.g. after settings change). */
export function resetAgent() {
  _agent = null
  _memory = null
}
