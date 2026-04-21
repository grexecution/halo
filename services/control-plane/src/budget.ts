export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export interface SessionBudgetOptions {
  maxTokens?: number | undefined
  maxCostUsd?: number | undefined
  maxToolCalls?: number | undefined
  maxWallTimeSeconds?: number | undefined
}

export interface ConsumeOptions {
  tokens?: number | undefined
  costUsd?: number | undefined
  toolCalls?: number | undefined
}

export class SessionBudget {
  private opts: SessionBudgetOptions
  private startTime: number
  totalTokens = 0
  totalCostUsd = 0
  totalToolCalls = 0

  constructor(opts: SessionBudgetOptions = {}) {
    this.opts = opts
    this.startTime = Date.now()
  }

  checkAndConsume(usage: ConsumeOptions): void {
    const { maxTokens, maxCostUsd, maxToolCalls, maxWallTimeSeconds } = this.opts

    if (maxWallTimeSeconds !== undefined) {
      const elapsed = (Date.now() - this.startTime) / 1000
      if (elapsed >= maxWallTimeSeconds) {
        throw new BudgetExceededError(
          `Session exceeded max wall time of ${maxWallTimeSeconds}s (elapsed: ${elapsed.toFixed(2)}s)`,
        )
      }
    }

    const nextTokens = this.totalTokens + (usage.tokens ?? 0)
    if (maxTokens !== undefined && nextTokens > maxTokens) {
      throw new BudgetExceededError(
        `Session exceeded max token budget of ${maxTokens} (would be ${nextTokens})`,
      )
    }

    const nextCost = this.totalCostUsd + (usage.costUsd ?? 0)
    if (maxCostUsd !== undefined && nextCost > maxCostUsd) {
      throw new BudgetExceededError(
        `Session exceeded max cost budget of $${maxCostUsd} (would be $${nextCost.toFixed(4)})`,
      )
    }

    const nextCalls = this.totalToolCalls + (usage.toolCalls ?? 0)
    if (maxToolCalls !== undefined && nextCalls > maxToolCalls) {
      throw new BudgetExceededError(
        `Session exceeded max tool calls of ${maxToolCalls} (would be ${nextCalls})`,
      )
    }

    this.totalTokens = nextTokens
    this.totalCostUsd = nextCost
    this.totalToolCalls = nextCalls
  }
}

export type DailyBudgetLevel = 'ok' | 'warn' | 'hard'

export interface DailyBudgetStatus {
  level: DailyBudgetLevel
  blocked: boolean
  total: number
  message?: string | undefined
}

export interface DailyBudgetOptions {
  softCapUsd?: number | undefined
  hardCapUsd?: number | undefined
}

export class DailyBudget {
  private softCapUsd: number
  private hardCapUsd: number
  private total = 0

  constructor(opts: DailyBudgetOptions = {}) {
    this.softCapUsd = opts.softCapUsd ?? 10
    this.hardCapUsd = opts.hardCapUsd ?? 50
  }

  record(usd: number): void {
    this.total += usd
  }

  status(): DailyBudgetStatus {
    if (this.total >= this.hardCapUsd) {
      return {
        level: 'hard',
        blocked: true,
        total: this.total,
        message: `Daily hard cap of $${this.hardCapUsd} reached ($${this.total.toFixed(2)} spent)`,
      }
    }
    const warnThreshold = this.hardCapUsd * 0.4
    if (this.total >= warnThreshold) {
      return {
        level: 'warn',
        blocked: false,
        total: this.total,
        message: `Daily spend at $${this.total.toFixed(2)} (${Math.round((this.total / this.hardCapUsd) * 100)}% of cap)`,
      }
    }
    return { level: 'ok', blocked: false, total: this.total }
  }

  totalUsd(): number {
    return this.total
  }

  resetDay(): void {
    this.total = 0
  }
}
