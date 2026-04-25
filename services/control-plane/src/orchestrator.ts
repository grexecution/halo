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

    if (!isSmallCtx) {
      // Inject user profile if available
      const profile = loadSettings().userProfile ?? {}
      const profileLines: string[] = []
      if (profile.name) profileLines.push(`The user's name is ${profile.name}.`)
      if (profile.occupation) profileLines.push(`They work as: ${profile.occupation}.`)
      if (profile.timezone) profileLines.push(`Their timezone is ${profile.timezone}.`)
      if (profile.customNotes) profileLines.push(`Notes about this user: ${profile.customNotes}`)
      if (profile.connectedServices?.length)
        profileLines.push(`Connected services: ${profile.connectedServices.join(', ')}.`)
      if (profileLines.length > 0)
        userProfileSection = `\n\n--- User profile ---\n${profileLines.join('\n')}`

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

    const contextualPrompt = `${basePrompt}${userProfileSection}${journalSection}${userModelSection}${skillsSection}`

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
        budget.checkAndConsume({ tokens: usage.totalTokens ?? 0 })
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
        budget.checkAndConsume({ tokens: result.usage.totalTokens ?? 0 })
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
