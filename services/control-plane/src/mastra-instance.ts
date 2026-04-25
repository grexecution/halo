/**
 * Singleton Mastra instance for the control-plane.
 * Owns the Agent, Memory, and tool registry.
 */
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore, LibSQLVector } from '@mastra/libsql'
import { PostgresStore, PgVector } from '@mastra/pg'
import { fastembed } from '@mastra/fastembed'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { allMastraTools } from './mastra-tools.js'
import { resolvePluginLlm } from './plugin-credentials.js'
import type { AgentConfig } from '@open-greg/agent-core'

const DIR = join(homedir(), '.open-greg')
const MEMORY_DB_URL = `file:${join(DIR, 'memory.db')}`
const PG_URL = process.env['DATABASE_URL']

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
  const ollamaUrl =
    process.env['OLLAMA_BASE_URL'] ?? process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
  const ollamaModel = process.env['OLLAMA_MODEL'] ?? settings.ollamaModel ?? 'llama3.2'
  return createOpenAI({ baseURL: `${ollamaUrl}/v1`, apiKey: 'ollama' }).chat(ollamaModel)
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

function buildMemory(): Memory {
  ensureDir()

  // Use Postgres when DATABASE_URL is set (server deploy), LibSQL otherwise (local dev/test)
  const storage = PG_URL
    ? new PostgresStore({ id: 'og-memory-store', connectionString: PG_URL })
    : new LibSQLStore({ id: 'og-memory-store', url: MEMORY_DB_URL })

  const vector = PG_URL
    ? new PgVector({ id: 'og-memory-vector', connectionString: PG_URL })
    : new LibSQLVector({ id: 'og-memory-vector', url: MEMORY_DB_URL })

  const anthropicKey = process.env['ANTHROPIC_API_KEY']
  const ollamaUrl =
    process.env['OLLAMA_BASE_URL'] ?? process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
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
      // Only enable observational memory when Anthropic is available.
      // On Ollama, simultaneous chat+observation calls OOM the runner.
      ...(anthropicKey
        ? {
            observationalMemory: {
              model: omModel,
              observation: { messageTokens: 20_000 },
            },
          }
        : {}),
    },
  })
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are Halo — a self-hosted AI agent running entirely on the user's own hardware.

Your character:
- Direct and efficient. No filler phrases, no "Certainly!", no "Great question!". Get to the point.
- Curious. You ask one clarifying question when it matters, not five.
- Dry wit when the moment calls for it — never forced, never at the user's expense.
- Honest about uncertainty. You say "I don't know" or "I'm not sure" rather than guessing.
- You treat the user as a peer. No hand-holding unless they ask for it.
- You remember things. When you know the user's name, use it occasionally. When you've done something before, reference it.

Your capabilities:
- You can run shell commands, read and write files, browse the web, execute code in an isolated sandbox.
- You can send Telegram messages, set up cron goals that fire automatically, and delegate to sub-agents for complex tasks.
- Everything runs locally. No data leaves the user's server.

How you work:
- When using tools, briefly say what you're doing and why — one sentence, not a paragraph.
- If a task will take multiple steps, outline them first, then execute.
- If something fails, diagnose before retrying. Don't repeat the same action twice expecting a different result.
- When you complete a task, say so plainly. Don't summarise what you just did at length.

Today's date, time, and the user's timezone are injected into each request.
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
    id: 'halo',
    name: 'Halo',
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
  _agentCache.clear()
}

// ---------------------------------------------------------------------------
// Per-agent cache — keyed by agentId so each DB agent gets its own instance
// ---------------------------------------------------------------------------

const _agentCache = new Map<string, Agent>()

/**
 * Return (or build) an Agent whose model + instructions match the DB config.
 * Falls back to the default model resolution if `cfg.model` is not recognised.
 */
export function getAgentForConfig(cfg: AgentConfig): Agent {
  // Plugin-backed agents are never cached: credentials can be updated in the
  // dashboard without restarting the control-plane, so we rebuild on each call.
  const isPluginModel = cfg.model.startsWith('plugin-')
  if (!isPluginModel) {
    const cached = _agentCache.get(cfg.id)
    if (cached) return cached
  }

  // Resolve the model — cfg.model is the raw modelId string from the DB.
  // Possible formats:
  //   "claude-haiku-4-5-20251001"       → Anthropic direct
  //   "gpt-4o"                           → OpenAI direct
  //   "plugin-kimi:kimi-k2.5"            → plugin-backed LLM (Kimi, DeepSeek, Groq, …)
  //   "llama3.2"                         → Ollama / any OpenAI-compatible fallback
  let model: ReturnType<typeof resolveModel>
  try {
    const anthropicKey = process.env['ANTHROPIC_API_KEY']
    const ollamaUrl =
      process.env['OLLAMA_BASE_URL'] ?? process.env['OLLAMA_URL'] ?? 'http://localhost:11434'

    // ── Plugin-backed LLM (highest priority) ──────────────────────────────────
    // Model IDs in this format are produced by the /api/models route when a
    // user has connected an AI plugin (Kimi, DeepSeek, Groq, Mistral, xAI …).
    // We read credentials from the shared SQLite DB and build an OpenAI-compat
    // provider pointed at the plugin's baseUrl.
    if (cfg.model.startsWith('plugin-')) {
      const pluginLlm = resolvePluginLlm(cfg.model)
      if (pluginLlm) {
        model = createOpenAI({
          baseURL: pluginLlm.baseUrl,
          apiKey: pluginLlm.apiKey,
        }).chat(pluginLlm.modelId)
      } else {
        // Plugin not connected or credentials missing — fall back to default
        model = resolveModel()
      }
    } else if (cfg.model.startsWith('claude-')) {
      model = createAnthropic({ apiKey: anthropicKey! })(
        cfg.model as Parameters<ReturnType<typeof createAnthropic>>[0],
      )
    } else if (
      cfg.model.startsWith('gpt-') ||
      cfg.model.startsWith('o1') ||
      cfg.model.startsWith('o3')
    ) {
      const openaiKey = process.env['OPENAI_API_KEY'] ?? ''
      model = createOpenAI({ apiKey: openaiKey }).chat(cfg.model)
    } else {
      // Ollama or custom OpenAI-compatible
      model = createOpenAI({ baseURL: `${ollamaUrl}/v1`, apiKey: 'ollama' }).chat(cfg.model)
    }
  } catch {
    // Fall back to the default model if resolution fails
    model = resolveModel()
  }

  const agent = new Agent({
    id: cfg.id,
    name: cfg.handle,
    instructions: cfg.systemPrompt || SYSTEM_PROMPT,
    model,
    tools: allMastraTools,
    memory: getMemory(),
  })

  if (!isPluginModel) {
    _agentCache.set(cfg.id, agent)
  }
  return agent
}
