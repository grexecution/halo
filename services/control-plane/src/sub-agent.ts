export interface DelegateOptions {
  handle: string
  task: string
  parentSessionId: string
}

export interface DelegateResult {
  content: string
  subSessionId: string
  toolCallBlock?: { toolId: string; args: Record<string, unknown>; result: string } | undefined
}

interface SubAgentOptions {
  dryRun?: boolean | undefined
}

export class SubAgentOrchestrator {
  private dryRun: boolean

  constructor(opts: SubAgentOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  async delegate(opts: DelegateOptions): Promise<DelegateResult> {
    const subSessionId = `sub-${opts.parentSessionId}-${opts.handle}-${Date.now()}`

    if (this.dryRun) {
      const content = `[${opts.handle}] Completed task: "${opts.task}". Result: Task handled successfully.`
      return {
        content,
        subSessionId,
        toolCallBlock: {
          toolId: 'delegate',
          args: { handle: opts.handle, task: opts.task },
          result: content,
        },
      }
    }

    throw new Error('Real sub-agent delegation requires LLM configuration')
  }
}

export interface MentionResult {
  handle: string
  task: string
}

export function parseMention(text: string): MentionResult | null {
  const match = text.match(/^@(\w+)\s+(.+)$/)
  if (!match) return null
  return {
    handle: match[1] ?? '',
    task: match[2]?.trim() ?? '',
  }
}
