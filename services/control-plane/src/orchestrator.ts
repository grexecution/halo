/**
 * AgentOrchestrator — thin wrapper around the Mastra Agent.
 * Handles turn execution, streaming, and budget enforcement.
 */
import type { Message } from '@open-greg/agent-core'
import { buildSystemPrompt } from '@open-greg/agent-core'
import type { AgentConfig } from '@open-greg/agent-core'
import { getAgent } from './mastra-instance.js'
import { SessionBudget } from './budget.js'
import { StuckLoopDetector } from './stuck-detector.js'
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

    // Inject timezone + date into system context
    const contextualPrompt = buildSystemPrompt(agent.systemPrompt, agent.timezone)

    if (this.dryRun) {
      return this.dryRunTurn(contextualPrompt, message, history, onChunk)
    }

    const mastraAgent = getAgent()
    const budget = new SessionBudget()
    const stuckDetector = new StuckLoopDetector()
    const toolCallLog: Array<{ toolCall: string }> = []

    // Build message list for Mastra (history + current)
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history.map((m) => ({
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
        for (const tc of toolCalls) {
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

      return {
        content: fullText,
        toolCalls: toolCalls?.map((tc) => ({
          toolId: tc.payload.toolName,
          args: tc.payload.args ?? {},
          result: {},
        })),
      }
    } else {
      // Non-streaming path
      const result = await mastraAgent.generate(messages, mastraOpts)

      if (result.usage) {
        budget.checkAndConsume({ tokens: result.usage.totalTokens ?? 0 })
      }

      return { content: result.text ?? '' }
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
