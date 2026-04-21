interface ReviewInput {
  task: string
  output: string
}

interface ReviewResult {
  approved: boolean
  iterations: number
  feedback?: string | undefined
}

interface CriticLoopOptions {
  dryRun?: boolean | undefined
  alwaysApprove?: boolean | undefined
  maxIterations?: number | undefined
}

export class CriticLoop {
  private dryRun: boolean
  private alwaysApprove: boolean
  private maxIterations: number

  constructor(opts: CriticLoopOptions = {}) {
    this.dryRun = opts.dryRun ?? false
    this.alwaysApprove = opts.alwaysApprove ?? true
    this.maxIterations = opts.maxIterations ?? 3
  }

  async review(_input: ReviewInput): Promise<ReviewResult> {
    if (!this.dryRun) {
      throw new Error('Real critic loop requires LLM — use dryRun: true for tests')
    }

    if (this.alwaysApprove) {
      return { approved: true, iterations: 1 }
    }

    // In dryRun revise mode: simulate 2 iterations then approve
    const iterations = Math.min(2, this.maxIterations)
    return {
      approved: true,
      iterations,
      feedback: 'Revised output after critic review',
    }
  }
}
