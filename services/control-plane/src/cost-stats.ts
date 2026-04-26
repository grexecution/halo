/**
 * F-208: Token/cost stats aggregator
 *
 * CostTracker records cost events per session and per tool.
 * CostStats returns aggregated statistics for the dashboard.
 *
 * This is an in-process store. In production it should be backed by
 * Postgres — this version provides the interface and in-memory implementation
 * suitable for tests and single-process deployments.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostEvent {
  sessionId: string
  agentId: string
  toolId?: string
  modelId?: string
  provider?: string
  isLocalModel?: boolean
  tokens: number
  costUsd: number
  timestamp: string
}

export interface SessionCostSummary {
  sessionId: string
  agentId: string
  totalTokens: number
  totalCostUsd: number
  startedAt: string
  lastActivityAt: string
}

export interface ToolCostSummary {
  toolId: string
  totalCalls: number
  totalTokens: number
  totalCostUsd: number
}

export interface DailyCostSummary {
  date: string // YYYY-MM-DD
  totalCostUsd: number
  totalTokens: number
}

export interface ModelCostSummary {
  modelId: string
  provider: string
  isLocalModel: boolean
  totalCalls: number
  totalTokens: number
  totalCostUsd: number
}

export interface CostStatsReport {
  sessions: SessionCostSummary[]
  tools: ToolCostSummary[]
  models: ModelCostSummary[]
  dailyTrend: DailyCostSummary[]
  totalCostUsd: number
  totalTokens: number
}

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

export class CostTracker {
  private events: CostEvent[] = []

  record(event: CostEvent): void {
    this.events.push(event)
  }

  getStats(opts: { days?: number } = {}): CostStatsReport {
    const days = opts.days ?? 7
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString()

    const recent = this.events.filter((e) => e.timestamp >= cutoffStr)

    // Session aggregation
    const sessionMap = new Map<string, SessionCostSummary>()
    for (const e of recent) {
      const existing = sessionMap.get(e.sessionId)
      if (existing) {
        existing.totalTokens += e.tokens
        existing.totalCostUsd += e.costUsd
        if (e.timestamp > existing.lastActivityAt) {
          existing.lastActivityAt = e.timestamp
        }
      } else {
        sessionMap.set(e.sessionId, {
          sessionId: e.sessionId,
          agentId: e.agentId,
          totalTokens: e.tokens,
          totalCostUsd: e.costUsd,
          startedAt: e.timestamp,
          lastActivityAt: e.timestamp,
        })
      }
    }

    // Tool aggregation
    const toolMap = new Map<string, ToolCostSummary>()
    for (const e of recent) {
      if (!e.toolId) continue
      const existing = toolMap.get(e.toolId)
      if (existing) {
        existing.totalCalls += 1
        existing.totalTokens += e.tokens
        existing.totalCostUsd += e.costUsd
      } else {
        toolMap.set(e.toolId, {
          toolId: e.toolId,
          totalCalls: 1,
          totalTokens: e.tokens,
          totalCostUsd: e.costUsd,
        })
      }
    }

    // Daily trend
    const dailyMap = new Map<string, DailyCostSummary>()
    for (const e of recent) {
      const date = e.timestamp.slice(0, 10) // YYYY-MM-DD
      const existing = dailyMap.get(date)
      if (existing) {
        existing.totalCostUsd += e.costUsd
        existing.totalTokens += e.tokens
      } else {
        dailyMap.set(date, { date, totalCostUsd: e.costUsd, totalTokens: e.tokens })
      }
    }

    // Model aggregation
    const modelMap = new Map<string, ModelCostSummary>()
    for (const e of recent) {
      if (!e.modelId) continue
      const provider = e.provider ?? 'unknown'
      const isLocalModel = e.isLocalModel ?? false
      const key = `${provider}:${e.modelId}:${isLocalModel ? 'local' : 'cloud'}`
      const existing = modelMap.get(key)
      if (existing) {
        existing.totalCalls += 1
        existing.totalTokens += e.tokens
        existing.totalCostUsd += e.costUsd
      } else {
        modelMap.set(key, {
          modelId: e.modelId,
          provider,
          isLocalModel,
          totalCalls: 1,
          totalTokens: e.tokens,
          totalCostUsd: e.costUsd,
        })
      }
    }

    const sessions = Array.from(sessionMap.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    const tools = Array.from(toolMap.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    const models = Array.from(modelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens)
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    const totalCostUsd = recent.reduce((s, e) => s + e.costUsd, 0)
    const totalTokens = recent.reduce((s, e) => s + e.tokens, 0)

    return { sessions, tools, models, dailyTrend, totalCostUsd, totalTokens }
  }

  reset(): void {
    this.events = []
  }
}

/** Singleton shared across the control-plane process. */
export const globalCostTracker = new CostTracker()
