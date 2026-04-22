import { buildSystemPrompt } from '@open-greg/agent-core'
import type { AgentConfig, Message, TurnResult } from '@open-greg/agent-core'

export interface RunTurnOptions {
  agent: AgentConfig
  message: string
  history?: Message[] | undefined
  onChunk?: ((chunk: string) => void) | undefined
}

interface OrchestratorOptions {
  dryRun?: boolean | undefined
}

export class AgentOrchestrator {
  private dryRun: boolean

  constructor(opts: OrchestratorOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  async runTurn(opts: RunTurnOptions): Promise<TurnResult> {
    const { agent, message, history = [], onChunk } = opts

    const systemPrompt = buildSystemPrompt(agent.systemPrompt, agent.timezone)

    if (this.dryRun) {
      return this.dryRunTurn(systemPrompt, message, history, onChunk)
    }

    // Real LLM path — delegates to Vercel AI SDK (implemented when API key available)
    throw new Error(
      'Real LLM path requires ANTHROPIC_API_KEY or similar — use dryRun: true for tests',
    )
  }

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
