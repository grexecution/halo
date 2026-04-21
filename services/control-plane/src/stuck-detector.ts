interface TurnInput {
  toolCall: string
}

interface AnalysisResult {
  stuck: boolean
  reason?: string | undefined
  resetPrompt?: string | undefined
}

interface StuckLoopOptions {
  windowSize?: number | undefined
}

export class StuckLoopDetector {
  private windowSize: number

  constructor(opts: StuckLoopOptions = {}) {
    this.windowSize = opts.windowSize ?? 3
  }

  analyze(turns: TurnInput[]): AnalysisResult {
    if (turns.length < this.windowSize) {
      return { stuck: false }
    }

    const window = turns.slice(-this.windowSize)
    const allSame = window.every((t) => t.toolCall === window[0]?.toolCall)

    if (allSame) {
      return {
        stuck: true,
        reason: `Repeated identical tool call ${this.windowSize} times: "${window[0]?.toolCall}"`,
        resetPrompt:
          'You appear to be stuck in a loop. Try a different approach or ask for clarification.',
      }
    }

    return { stuck: false }
  }
}
