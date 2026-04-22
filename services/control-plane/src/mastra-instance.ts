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
import { mkdirSync, existsSync } from 'node:fs'
import { allMastraTools } from './mastra-tools.js'

const DIR = join(homedir(), '.open-greg')
const MEMORY_DB_URL = `file:${join(DIR, 'memory.db')}`

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

function resolveModel() {
  const provider = process.env['LLM_PROVIDER'] ?? 'auto'
  const anthropicKey = process.env['ANTHROPIC_API_KEY']

  if (provider === 'anthropic' || (provider === 'auto' && anthropicKey)) {
    return createAnthropic({ apiKey: anthropicKey! })(
      (process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5-20251001') as Parameters<
        ReturnType<typeof createAnthropic>
      >[0],
    )
  }

  // Ollama / OpenAI-compatible
  const ollamaUrl = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
  const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
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
  const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'llama3.2'

  const omModel = anthropicKey
    ? createAnthropic({ apiKey: anthropicKey })('claude-haiku-4-5-20251001')
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
