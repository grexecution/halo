/**
 * AgentOrchestrator — thin wrapper around the Mastra Agent.
 * Handles turn execution, streaming, and budget enforcement.
 */
import type { Message } from '@open-greg/agent-core'
import { buildSystemPrompt } from '@open-greg/agent-core'
import type { AgentConfig } from '@open-greg/agent-core'
import { getAgent, getAgentForConfig } from './mastra-instance.js'
import { loadSettings } from './setup-store.js'
import { SessionBudget } from './budget.js'
import { StuckLoopDetector } from './stuck-detector.js'
import { skillLoader } from './skill-loader.js'
import { SkillReflector, buildLLMGenerateFn } from './skill-reflector.js'
import { SkillStore } from './skill-store.js'
import { journalAppend, readRecentJournal } from './journal.js'
import { userModelStore, detectCorrection } from './user-model-store.js'
import { SKILLS_DIR } from './skill-loader.js'
import {
  RequestContext,
  MASTRA_THREAD_ID_KEY,
  MASTRA_RESOURCE_ID_KEY,
} from '@mastra/core/request-context'
import { getMemoryPipeline, detectQueryType, extractFactKey } from './memory-pipeline.js'
import { parsePluginModelId } from './plugin-credentials.js'
import { globalCostTracker } from './cost-stats.js'

// Token budgets for memory injection
const CLOUD_MEMORY_BUDGET = 8_000 // cloud models (GPT-4.1, Claude — large context)
const OLLAMA_MEMORY_BUDGET = 500 // local 4096-token models — strict cap
const CHARS_PER_TOKEN = 4 // rough estimate for token counting

const MODEL_PRICING_PER_1M_TOKENS_USD: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
  // OpenAI
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  o1: { input: 15.0, output: 60.0 },
  o3: { input: 10.0, output: 40.0 },
  'o4-mini': { input: 1.1, output: 4.4 },
}

interface ModelTrackingInfo {
  modelId: string
  provider: string
  isLocalModel: boolean
}

interface UsageLike {
  totalTokens?: number | undefined
  inputTokens?: number | undefined
  outputTokens?: number | undefined
}

function resolveAutoModel(): ModelTrackingInfo {
  const hasAnthropic = Boolean(process.env['ANTHROPIC_API_KEY'])
  if (hasAnthropic) {
    return {
      modelId: process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5-20251001',
      provider: 'anthropic',
      isLocalModel: false,
    }
  }
  return {
    modelId: process.env['OLLAMA_MODEL'] ?? 'llama3.2',
    provider: 'ollama',
    isLocalModel: true,
  }
}

function resolveModelTrackingInfo(agentModel: string): ModelTrackingInfo {
  if (agentModel === 'auto') return resolveAutoModel()

  const plugin = parsePluginModelId(agentModel)
  if (plugin) {
    return {
      modelId: plugin.variantModelId,
      provider: plugin.pluginId,
      isLocalModel: false,
    }
  }

  if (agentModel.startsWith('claude-')) {
    return { modelId: agentModel, provider: 'anthropic', isLocalModel: false }
  }
  if (agentModel.startsWith('gpt-') || agentModel.startsWith('o1') || agentModel.startsWith('o3')) {
    return { modelId: agentModel, provider: 'openai', isLocalModel: false }
  }
  return { modelId: agentModel, provider: 'ollama', isLocalModel: true }
}

function estimateUsageCostUsd(modelInfo: ModelTrackingInfo, usage: UsageLike): number {
  if (modelInfo.isLocalModel) return 0

  const pricing = MODEL_PRICING_PER_1M_TOKENS_USD[modelInfo.modelId]
  if (!pricing) return 0

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? Math.max(0, (usage.totalTokens ?? 0) - inputTokens)
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

const HEALTH_METRIC_PATTERNS: [RegExp, string][] = [
  [/heart rate|hrv/i, 'heart_rate'],
  [/steps/i, 'steps'],
  [/sleep/i, 'sleep_hours'],
  [/weight/i, 'weight'],
  [/vo2/i, 'vo2max'],
]

function detectHealthMetric(query: string): string {
  return HEALTH_METRIC_PATTERNS.find(([p]) => p.test(query))?.[1] ?? 'heart_rate'
}

/**
 * Build the memory context section to inject into the system prompt.
 * Routes to the appropriate tier based on query type:
 *   Tier 1: Pinned facts (name, company, etc.) — always < 5ms
 *   Tier 2: Hybrid BM25+vector search — < 200ms
 *   Tier 3: Health trend SQL aggregates — bypasses semantic entirely
 */
async function buildMemorySection(query: string, isSmallCtx: boolean): Promise<string> {
  const pipeline = getMemoryPipeline()
  if (!pipeline) return '' // pipeline not yet initialised (Postgres not connected)

  const budget = isSmallCtx ? OLLAMA_MEMORY_BUDGET : CLOUD_MEMORY_BUDGET
  const qtype = detectQueryType(query)

  try {
    // Tier 1: Pinned fact lookup
    if (qtype === 'fact') {
      const key = extractFactKey(query)
      if (key) {
        const value = await pipeline.getFact(key)
        if (value)
          return `\n\n--- Key fact ---\n${key.replace('user.', '').replace('.', ' ')}: ${value}`
      }
    }

    // Tier 3: Health trend (structured SQL aggregate — no vector search needed)
    if (qtype === 'health') {
      const metric = detectHealthMetric(query)
      const trend = await pipeline.healthTrendQuery({ metric, period: 'month', span: 60 })
      if (trend.length > 0) {
        const summary = pipeline.formatHealthTrend(trend, metric, '')
        return `\n\n--- Health trend (${metric}) ---\n${summary}`
      }
    }

    // Tier 2: Hybrid BM25 + vector search
    const results = isSmallCtx
      ? await pipeline.ollamaSearch(query, 5)
      : await pipeline.hybridSearch(query, { limit: 50 })

    if (results.length === 0) return ''

    // Fill token budget (stop before overflowing context)
    const lines = ['--- Relevant memory ---']
    let tokens = 40
    for (const m of results) {
      const line = `[${m.source} @ ${m.createdAt.slice(0, 10)}] ${m.content}`
      const t = Math.ceil(line.length / CHARS_PER_TOKEN)
      if (tokens + t > budget) break
      lines.push(line)
      tokens += t
    }
    return lines.length > 1 ? `\n\n${lines.join('\n')}` : ''
  } catch {
    // Never crash the chat turn due to memory failure
    return ''
  }
}

export interface RunTurnOptions {
  agent: AgentConfig
  message: string
  history?: Message[] | undefined
  onChunk?: ((chunk: string) => void) | undefined
  onToolCall?: ((name: string, args: unknown) => void) | undefined
  sessionId?: string | undefined
  threadId?: string | undefined
  resourceId?: string | undefined
}

export interface TurnResult {
  content: string
  toolCalls?: Array<{ toolId: string; args: unknown; result: unknown }> | undefined
}

interface OrchestratorOptions {
  /** @deprecated dryRun kept for backward-compat with existing tests */
  dryRun?: boolean | undefined
}

export class AgentOrchestrator {
  private dryRun: boolean

  constructor(opts: OrchestratorOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  async runTurn(opts: RunTurnOptions): Promise<TurnResult> {
    const { agent, message, history = [], onChunk, onToolCall, threadId, resourceId } = opts
    const modelInfo = resolveModelTrackingInfo(agent.model ?? 'auto')

    // Detect small-context local models (Ollama) — skip heavy prompt injection to
    // stay under the 4096 ctx limit. Cloud/plugin models get full context.
    const m = agent.model ?? 'auto'
    const isSmallCtx =
      m !== 'auto' &&
      !m.startsWith('plugin-') &&
      !m.startsWith('claude-') &&
      !m.startsWith('gpt-') &&
      !m.startsWith('o1') &&
      !m.startsWith('o3')

    // Inject timezone + date into system context
    const basePrompt = buildSystemPrompt(agent.systemPrompt, agent.timezone)

    let userProfileSection = ''
    let journalSection = ''
    let skillsSection = ''
    let userModelSection = ''

    // Always inject a minimal user profile so the model knows who it's talking to.
    // For small-ctx models keep it to 1-2 lines to stay under the 4096 token limit.
    const profile = loadSettings().userProfile ?? {}
    const minimalProfileLines: string[] = []
    if (profile.name) minimalProfileLines.push(`The user's name is ${profile.name}.`)
    if (profile.occupation) minimalProfileLines.push(`They work as: ${profile.occupation}.`)
    if (minimalProfileLines.length > 0)
      userProfileSection = `\n\n--- User profile ---\n${minimalProfileLines.join('\n')}`

    if (!isSmallCtx) {
      // Full profile injection for cloud models
      const extraLines: string[] = []
      if (profile.timezone) extraLines.push(`Their timezone is ${profile.timezone}.`)
      if (profile.customNotes) extraLines.push(`Notes about this user: ${profile.customNotes}`)
      if (profile.connectedServices?.length)
        extraLines.push(`Connected services: ${profile.connectedServices.join(', ')}.`)
      if (extraLines.length > 0) userProfileSection += `\n${extraLines.join('\n')}`

      // Inject journal (last 3 days of conversation history — the "long memory" layer)
      const journalContent = readRecentJournal(3)
      if (journalContent)
        journalSection = `\n\n--- Recent conversation history (journal) ---\n${journalContent}`

      // Inject skills block (credential-aware, built fresh each turn)
      await skillLoader.injectCredentials()
      const skillsBlock = await skillLoader.buildPromptBlock()
      if (skillsBlock) skillsSection = `\n\n--- Skills ---\n${skillsBlock}`

      // Inject learned user preferences from UserModel
      const userModelBlock = userModelStore.buildPromptBlock({ includeDrift: true })
      if (userModelBlock)
        userModelSection = `\n\n--- Learned user preferences ---\n${userModelBlock}`
    }

    // Inject lifetime memory (Tier 1/2/3) — budget-aware, never crashes chat
    const memorySection = await buildMemorySection(message, isSmallCtx)

    const contextualPrompt = `${basePrompt}${userProfileSection}${journalSection}${userModelSection}${skillsSection}${memorySection}`

    if (this.dryRun) {
      return this.dryRunTurn(contextualPrompt, message, history, onChunk)
    }

    const mastraAgent =
      agent.model && agent.model !== 'auto' ? getAgentForConfig(agent) : getAgent()
    const budget = new SessionBudget()
    const stuckDetector = new StuckLoopDetector()
    const toolCallLog: Array<{ toolCall: string }> = []

    // Build message list for Mastra (history + current).
    // For small-context models, cap history at the last 6 messages to stay
    // well under the 4096 token context window.
    const historySlice = isSmallCtx ? history.slice(-6) : history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...historySlice.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const requestContext = new RequestContext()
    if (threadId) requestContext.set(MASTRA_THREAD_ID_KEY, threadId)
    if (resourceId) requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId)

    const mastraOpts = {
      ...(threadId ? { threadId } : {}),
      ...(resourceId ? { resourceId } : {}),
      requestContext,
      instructions: contextualPrompt,
    }

    if (onChunk) {
      // Streaming path
      const stream = await mastraAgent.stream(messages, mastraOpts)

      let fullText = ''
      for await (const chunk of stream.textStream) {
        fullText += chunk
        onChunk(chunk)
      }

      // Check for stuck loops based on tool calls
      const toolCalls = await stream.toolCalls
      if (toolCalls) {
        for (const tc of toolCalls as Array<{ payload: { toolName: string; args?: unknown } }>) {
          const toolName = tc.payload.toolName
          const toolArgs = tc.payload.args ?? {}
          toolCallLog.push({ toolCall: toolName })
          onToolCall?.(toolName, toolArgs)
          const analysis = stuckDetector.analyze(toolCallLog)
          if (analysis.stuck) {
            // Inject reset prompt into the response to break the loop
            const notice = `\n\n[System: ${analysis.resetPrompt ?? 'Please try a different approach.'}]`
            onChunk(notice)
            fullText += notice
            break
          }
        }
      }

      const usage = await stream.usage
      if (usage) {
        const costUsd = estimateUsageCostUsd(modelInfo, usage)
        budget.checkAndConsume({ tokens: usage.totalTokens ?? 0, costUsd })
        globalCostTracker.record({
          sessionId: opts.sessionId ?? threadId ?? 'default',
          agentId: agent.id,
          modelId: modelInfo.modelId,
          provider: modelInfo.provider,
          isLocalModel: modelInfo.isLocalModel,
          tokens: usage.totalTokens ?? 0,
          costUsd,
          timestamp: new Date().toISOString(),
        })
      }

      const turnResult: TurnResult = {
        content: fullText,
        toolCalls: (
          toolCalls as Array<{ payload: { toolName: string; args?: unknown } }> | undefined
        )?.map((tc) => ({
          toolId: tc.payload.toolName,
          args: tc.payload.args ?? {},
          result: {},
        })),
      }

      // Post-turn side effects (all best-effort, never throw)
      await this.postTurn(opts.agent.id, message, fullText, toolCallLog)
      return turnResult
    } else {
      // Non-streaming path
      const result = await mastraAgent.generate(messages, mastraOpts)

      if (result.usage) {
        const costUsd = estimateUsageCostUsd(modelInfo, result.usage)
        budget.checkAndConsume({ tokens: result.usage.totalTokens ?? 0, costUsd })
        globalCostTracker.record({
          sessionId: opts.sessionId ?? threadId ?? 'default',
          agentId: agent.id,
          modelId: modelInfo.modelId,
          provider: modelInfo.provider,
          isLocalModel: modelInfo.isLocalModel,
          tokens: result.usage.totalTokens ?? 0,
          costUsd,
          timestamp: new Date().toISOString(),
        })
      }

      const text = result.text ?? ''
      await this.postTurn(opts.agent.id, message, text, [])
      return { content: text }
    }
  }

  // -------------------------------------------------------------------------
  // Post-turn side effects
  // -------------------------------------------------------------------------

  private async postTurn(
    agentId: string,
    userMessage: string,
    agentReply: string,
    toolCallLog: Array<{ toolCall: string }>,
  ): Promise<void> {
    // 1. Append to daily journal
    journalAppend(agentId, userMessage, agentReply).catch(() => {})

    // 2. Detect user corrections and update UserModel
    detectCorrection(userMessage, agentReply).catch(() => {})

    // 3. Auto-reflect into a skill if enough tool calls happened
    if (toolCallLog.length >= 3) {
      try {
        const store = new SkillStore(SKILLS_DIR)
        const callLLM = async (prompt: string): Promise<string> => {
          const agent = getAgent()
          const r = await agent.generate([{ role: 'user', content: prompt }], {})
          return r.text ?? ''
        }
        const reflector = new SkillReflector(store, {
          generate: buildLLMGenerateFn(callLLM),
          minToolCalls: 3,
        })
        const entries = toolCallLog.map((t) => ({ toolId: t.toolCall, args: {}, result: {} }))
        await reflector.reflect(agentId, entries)
        // Reload skills so new skill appears in next turn
        await skillLoader.reload()
      } catch {
        // best-effort
      }
    }
  }

  // -------------------------------------------------------------------------
  // dryRun path — preserved for existing tests
  // -------------------------------------------------------------------------

  private dryRunTurn(
    systemPrompt: string,
    message: string,
    _history: Message[],
    onChunk?: ((chunk: string) => void) | undefined,
  ): TurnResult {
    const lower = message.toLowerCase()
    let content: string

    if (lower.includes('time') || lower.includes('date')) {
      const timeLine = systemPrompt.split('\n')[0] ?? ''
      content = `Based on my context: ${timeLine}`
    } else if (lower.includes('hello') || lower.includes('hi')) {
      content = 'Hello! How can I help you today?'
    } else {
      content = `I received your message: "${message}". How can I help?`
    }

    if (onChunk) onChunk(content)
    return { content }
  }
}
