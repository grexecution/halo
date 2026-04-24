'use client'

import type { ReactNode } from 'react'
import { useEffect, useState, useCallback } from 'react'
import {
  MessageSquare,
  Target,
  Clock,
  Smartphone,
  Zap,
  PlayCircle,
  ChevronUp,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'
import { TableSkeleton, StatBannerSkeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'

interface AgentRun {
  id: string
  agentId: string
  chatId: string | null
  goalId: string | null
  trigger: string
  status: 'running' | 'completed' | 'failed' | 'aborted'
  input: string
  output: string | null
  toolCalls: Array<{ toolId: string; args: unknown }>
  tokenCount: number
  costUsd: number
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  error: string | null
}

interface RunStats {
  total: number
  completed: number
  failed: number
  total_tokens: number
  total_cost: number
}

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  aborted: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

const TRIGGER_ICONS: Record<string, ReactNode> = {
  chat: <MessageSquare size={14} className="text-gray-400" />,
  goal: <Target size={14} className="text-gray-400" />,
  cron: <Clock size={14} className="text-gray-400" />,
  telegram: <Smartphone size={14} className="text-gray-400" />,
  discord: <Smartphone size={14} className="text-gray-400" />,
  default: <Zap size={14} className="text-gray-400" />,
}

function fmtDuration(ms: number | null) {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function fmtCost(usd: number) {
  if (usd === 0) return '—'
  if (usd < 0.001) return '<$0.001'
  return `$${usd.toFixed(4)}`
}

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [stats, setStats] = useState<RunStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [agentFilter, setAgentFilter] = useState('')

  const load = useCallback(() => {
    const url = agentFilter ? `/api/runs?agentId=${encodeURIComponent(agentFilter)}` : '/api/runs'
    fetch(url)
      .then((r) => r.json())
      .then((d: { runs?: AgentRun[]; stats?: RunStats }) => {
        setRuns(d.runs ?? [])
        setStats(d.stats ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [agentFilter])

  useEffect(() => {
    load()
    const t = setInterval(load, 5_000)
    return () => clearInterval(t)
  }, [load])

  const agentIds = [...new Set(runs.map((r) => r.agentId))]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Agent Runs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Execution history, costs, and tool traces</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Stats banner */}
      {loading ? (
        <StatBannerSkeleton count={4} />
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-fade-in">
          {[
            { label: 'Total runs', value: stats.total },
            { label: 'Completed', value: stats.completed },
            { label: 'Failed', value: stats.failed },
            { label: 'Total cost', value: fmtCost(stats.total_cost) },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-xl font-semibold text-white">{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Agent filter */}
      {agentIds.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setAgentFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              agentFilter === ''
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            All agents
          </button>
          {agentIds.map((id) => (
            <button
              key={id}
              onClick={() => setAgentFilter(id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                agentFilter === id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              @{id}
            </button>
          ))}
        </div>
      )}

      {/* Runs list */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<PlayCircle size={32} />}
          title="No runs yet"
          description="Start a chat or trigger a goal to see agent runs here"
        />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* Row */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpanded(expanded === run.id ? null : run.id)}
              >
                <span className="flex-shrink-0">
                  {TRIGGER_ICONS[run.trigger] ?? TRIGGER_ICONS.default}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[run.status]}`}
                    >
                      {run.status}
                    </span>
                    <span className="text-xs text-gray-500">@{run.agentId}</span>
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500">
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 truncate mt-0.5">{run.input}</p>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-gray-500 space-y-0.5">
                  <div>{fmtDuration(run.durationMs)}</div>
                  <div>{fmtCost(run.costUsd)}</div>
                  {run.toolCalls.length > 0 && (
                    <div className="text-blue-400">{run.toolCalls.length} tools</div>
                  )}
                </div>
                <span className="text-gray-600 ml-1">
                  {expanded === run.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {/* Expanded detail */}
              {expanded === run.id && (
                <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                  {run.output && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Output</div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {run.output.slice(0, 1000)}
                        {run.output.length > 1000 && (
                          <span className="text-gray-600"> …[truncated]</span>
                        )}
                      </p>
                    </div>
                  )}

                  {run.error && (
                    <div className="bg-red-950/50 border border-red-900 rounded-lg p-3">
                      <div className="text-xs text-red-400 font-medium mb-1">Error</div>
                      <p className="text-sm text-red-300 font-mono">{run.error}</p>
                    </div>
                  )}

                  {run.toolCalls.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-2">
                        Tool calls ({run.toolCalls.length})
                      </div>
                      <div className="space-y-1.5">
                        {run.toolCalls.map((tc, i) => (
                          <div
                            key={i}
                            className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs font-mono"
                          >
                            <span className="text-blue-400">{tc.toolId}</span>
                            {tc.args !== undefined && (
                              <span className="text-gray-500 ml-2">
                                {JSON.stringify(tc.args).slice(0, 120)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-gray-600">
                    <span>Tokens: {run.tokenCount.toLocaleString()}</span>
                    <span>Cost: {fmtCost(run.costUsd)}</span>
                    {run.chatId && (
                      <a
                        href={`/chat?id=${run.chatId}`}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        View chat →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
