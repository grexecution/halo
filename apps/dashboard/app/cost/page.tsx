'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, Zap, DollarSign, BarChart3 } from 'lucide-react'
import { Badge } from '../components/ui/index'

// ---------------------------------------------------------------------------
// Types (mirrors services/control-plane/src/cost-stats.ts)
// ---------------------------------------------------------------------------

interface SessionCostSummary {
  sessionId: string
  agentId: string
  totalTokens: number
  totalCostUsd: number
  startedAt: string
  lastActivityAt: string
}

interface ToolCostSummary {
  toolId: string
  totalCalls: number
  totalTokens: number
  totalCostUsd: number
}

interface ModelCostSummary {
  modelId: string
  provider: string
  isLocalModel: boolean
  totalCalls: number
  totalTokens: number
  totalCostUsd: number
}

interface DailyCostSummary {
  date: string
  totalCostUsd: number
  totalTokens: number
}

interface CostStatsReport {
  sessions: SessionCostSummary[]
  tools: ToolCostSummary[]
  models: ModelCostSummary[]
  dailyTrend: DailyCostSummary[]
  totalCostUsd: number
  totalTokens: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(n: number) {
  return n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(3)}`
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

// ---------------------------------------------------------------------------
// Mini bar chart (pure CSS/SVG, no chart library needed)
// ---------------------------------------------------------------------------

function TrendBar({ days, maxCost }: { days: DailyCostSummary[]; maxCost: number }) {
  if (days.length === 0) {
    return <p className="text-gray-600 text-sm">No trend data yet.</p>
  }
  return (
    <div data-testid="cost-trend-chart" className="flex items-end gap-1 h-16">
      {days.map((d) => {
        const pct = maxCost > 0 ? (d.totalCostUsd / maxCost) * 100 : 0
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full bg-indigo-500 rounded-sm"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${d.date}: ${fmt$(d.totalCostUsd)}`}
            />
            <span className="text-xs text-gray-600 truncate">{d.date.slice(5)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode
  label: string
  value: string
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-4"
    >
      <div className="text-indigo-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CostPage() {
  const [stats, setStats] = useState<CostStatsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const [modelSearch, setModelSearch] = useState('')
  const [modelScope, setModelScope] = useState<'all' | 'cloud' | 'local'>('all')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/cost-stats')
      if (res.ok) {
        const data = (await res.json()) as CostStatsReport
        setStats(data)
      }
    } catch {
      // control-plane offline
    } finally {
      setLoading(false)
      setLastFetch(new Date().toLocaleTimeString())
    }
  }, [])

  useEffect(() => {
    void fetchStats()
    const interval = setInterval(() => void fetchStats(), 10_000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const maxCost = stats?.dailyTrend.reduce((m, d) => Math.max(m, d.totalCostUsd), 0) ?? 0
  const filteredModels =
    stats?.models.filter((m) => {
      const q = modelSearch.trim().toLowerCase()
      const matchesSearch =
        q.length === 0 ||
        m.modelId.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
      const matchesScope =
        modelScope === 'all' ||
        (modelScope === 'local' && m.isLocalModel) ||
        (modelScope === 'cloud' && !m.isLocalModel)
      return matchesSearch && matchesScope
    }) ?? []

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Token Cost Dashboard</h1>
          {loading && <RefreshCw size={14} className="text-gray-600 animate-spin" />}
          {lastFetch && !loading && (
            <span className="text-xs text-gray-600">updated {lastFetch}</span>
          )}
        </div>
        <button
          onClick={() => void fetchStats()}
          className="text-gray-500 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary cards */}
      <div data-testid="cost-summary" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign size={20} />}
          label="Total spend (7d)"
          value={fmt$(stats?.totalCostUsd ?? 0)}
          testId="stat-total-cost"
        />
        <StatCard
          icon={<Zap size={20} />}
          label="Total tokens (7d)"
          value={fmtK(stats?.totalTokens ?? 0)}
          testId="stat-total-tokens"
        />
        <StatCard
          icon={<BarChart3 size={20} />}
          label="Sessions"
          value={String(stats?.sessions.length ?? 0)}
          testId="stat-sessions"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Tools tracked"
          value={String(stats?.tools.length ?? 0)}
          testId="stat-tools"
        />
      </div>

      {/* Daily trend */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">7-day spend trend</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <TrendBar days={stats?.dailyTrend ?? []} maxCost={maxCost} />
        </div>
      </section>

      {/* Cost per tool */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Cost by tool</h2>
        <div
          data-testid="tool-cost-table"
          className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
        >
          {!stats || stats.tools.length === 0 ? (
            <p className="p-4 text-gray-600 text-sm">No tool cost data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="p-3 text-left">Tool</th>
                  <th className="p-3 text-right">Calls</th>
                  <th className="p-3 text-right">Tokens</th>
                  <th className="p-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.tools.map((t) => (
                  <tr key={t.toolId} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                    <td className="p-3 font-mono text-indigo-300">{t.toolId}</td>
                    <td className="p-3 text-right text-gray-300">{t.totalCalls}</td>
                    <td className="p-3 text-right text-gray-300">{fmtK(t.totalTokens)}</td>
                    <td className="p-3 text-right text-white font-medium">
                      {fmt$(t.totalCostUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Usage by model */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Usage by model</h2>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            data-testid="model-filter-search"
            type="text"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            placeholder="Filter models by name or provider…"
            className="w-full md:max-w-sm rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <div
            data-testid="model-filter-scope"
            className="inline-flex rounded-md border border-gray-700 bg-gray-950 p-1"
          >
            <button
              type="button"
              onClick={() => setModelScope('all')}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                modelScope === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setModelScope('cloud')}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                modelScope === 'cloud'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Cloud
            </button>
            <button
              type="button"
              onClick={() => setModelScope('local')}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                modelScope === 'local'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Local
            </button>
          </div>
        </div>
        <div
          data-testid="model-usage-table"
          className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
        >
          {!stats || (stats.models ?? []).length === 0 ? (
            <p className="p-4 text-gray-600 text-sm">No model usage data yet.</p>
          ) : filteredModels.length === 0 ? (
            <p className="p-4 text-gray-600 text-sm">No models match the active filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="p-3 text-left">Model</th>
                  <th className="p-3 text-left">Provider</th>
                  <th className="p-3 text-right">Calls</th>
                  <th className="p-3 text-right">Tokens</th>
                  <th className="p-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((m) => (
                  <tr
                    key={`${m.provider}:${m.modelId}`}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40"
                  >
                    <td className="p-3 font-mono text-indigo-300">{m.modelId}</td>
                    <td className="p-3 text-gray-300">{m.provider}</td>
                    <td className="p-3 text-right text-gray-300">{m.totalCalls}</td>
                    <td className="p-3 text-right text-gray-300">{fmtK(m.totalTokens)}</td>
                    <td className="p-3 text-right text-white font-medium">
                      {m.isLocalModel ? 'local (no cost)' : fmt$(m.totalCostUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Recent sessions */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Recent sessions</h2>
        <div
          data-testid="session-cost-table"
          className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
        >
          {!stats || stats.sessions.length === 0 ? (
            <p className="p-4 text-gray-600 text-sm">No session data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="p-3 text-left">Session</th>
                  <th className="p-3 text-left">Agent</th>
                  <th className="p-3 text-right">Tokens</th>
                  <th className="p-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.sessions.map((s) => (
                  <tr
                    key={s.sessionId}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40"
                  >
                    <td className="p-3 font-mono text-xs text-gray-400 truncate max-w-[120px]">
                      {s.sessionId.slice(0, 8)}…
                    </td>
                    <td className="p-3">
                      <Badge variant="info">{s.agentId}</Badge>
                    </td>
                    <td className="p-3 text-right text-gray-300">{fmtK(s.totalTokens)}</td>
                    <td className="p-3 text-right text-white font-medium">
                      {fmt$(s.totalCostUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}
