'use client'

import type { ReactNode } from 'react'
import { useEffect, useState, useCallback, useRef } from 'react'
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
  Terminal,
  AlertTriangle,
  Info,
  Bug,
} from 'lucide-react'
import { TableSkeleton, StatBannerSkeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  agentId?: string
  toolId?: string
  durationMs?: number
  tokenCount?: number
  costUsd?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-blue-500/15 text-primary border-primary/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  aborted: 'bg-muted/50 text-muted-foreground border-muted',
}

const TRIGGER_ICONS: Record<string, ReactNode> = {
  chat: <MessageSquare size={14} className="text-muted-foreground" />,
  goal: <Target size={14} className="text-muted-foreground" />,
  cron: <Clock size={14} className="text-muted-foreground" />,
  telegram: <Smartphone size={14} className="text-muted-foreground" />,
  discord: <Smartphone size={14} className="text-muted-foreground" />,
  default: <Zap size={14} className="text-muted-foreground" />,
}

const LEVEL_BADGE_VARIANT: Record<LogLevel, 'info' | 'warning' | 'danger' | 'muted'> = {
  info: 'info',
  warn: 'warning',
  error: 'danger',
  debug: 'muted',
}

const LEVEL_ICONS: Record<LogLevel, ReactNode> = {
  info: <Info size={13} className="text-blue-400" />,
  warn: <AlertTriangle size={13} className="text-yellow-400" />,
  error: <AlertTriangle size={13} className="text-red-400" />,
  debug: <Bug size={13} className="text-muted-foreground" />,
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

// ─── Runs Tab ─────────────────────────────────────────────────────────────────

function RunsTab() {
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
    <div className="space-y-4">
      {/* Stats */}
      {loading ? (
        <StatBannerSkeleton count={4} />
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
          {[
            { label: 'Total runs', value: stats.total },
            { label: 'Completed', value: stats.completed },
            { label: 'Failed', value: stats.failed },
            { label: 'Total cost', value: fmtCost(stats.total_cost) },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-4 border border-border">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="text-xl font-semibold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Agent filter */}
      {agentIds.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAgentFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              agentFilter === ''
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground/80'
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
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground/80'
              }`}
            >
              @{id}
            </button>
          ))}
        </div>
      )}

      {/* List */}
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
            <div key={run.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
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
                    <span className="text-xs text-muted-foreground">@{run.agentId}</span>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 truncate mt-0.5">{run.input}</p>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-muted-foreground space-y-0.5">
                  <div>{fmtDuration(run.durationMs)}</div>
                  <div>{fmtCost(run.costUsd)}</div>
                  {run.toolCalls.length > 0 && (
                    <div className="text-primary">{run.toolCalls.length} tools</div>
                  )}
                </div>
                <span className="text-muted-foreground/60 ml-1">
                  {expanded === run.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {expanded === run.id && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {run.output && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Output</div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {run.output.slice(0, 1000)}
                        {run.output.length > 1000 && (
                          <span className="text-muted-foreground/60"> …[truncated]</span>
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
                      <div className="text-xs text-muted-foreground mb-2">
                        Tool calls ({run.toolCalls.length})
                      </div>
                      <div className="space-y-1.5">
                        {run.toolCalls.map((tc, i) => (
                          <div
                            key={i}
                            className="bg-muted/60 rounded-lg px-3 py-2 text-xs font-mono"
                          >
                            <span className="text-primary">{tc.toolId}</span>
                            {tc.args !== undefined && (
                              <span className="text-muted-foreground ml-2">
                                {JSON.stringify(tc.args).slice(0, 120)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-muted-foreground/60">
                    <span>Tokens: {run.tokenCount.toLocaleString()}</span>
                    <span>Cost: {fmtCost(run.costUsd)}</span>
                    {run.chatId && (
                      <a
                        href={`/chat?id=${run.chatId}`}
                        className="text-primary hover:text-primary/80"
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

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const [level, setLevel] = useState<string>('')
  const [agentId, setAgentId] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    if (agentId.trim()) params.set('agentId', agentId.trim())
    const res = await fetch(`/api/logs?${params.toString()}`).catch(() => null)
    if (!res?.ok) return
    const data = (await res.json()) as { logs?: LogEntry[] }
    setLogs(data.logs ?? [])
    setLastFetch(new Date().toLocaleTimeString())
    setLoading(false)
  }, [level, agentId])

  useEffect(() => {
    void fetchLogs()
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void fetchLogs(), 3000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchLogs, autoRefresh])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-36">
          <Label className="text-xs mb-1 block">Log level</Label>
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </Select>
        </div>
        <div className="flex-1 min-w-32">
          <Label className="text-xs mb-1 block">Filter by agent</Label>
          <Input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="Agent ID"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="auto-refresh" checked={autoRefresh} onChange={setAutoRefresh} />
          <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
            Auto-refresh
          </Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchLogs()}>
          <RefreshCw size={13} />
          Refresh
        </Button>
      </div>

      {lastFetch && <p className="text-xs text-muted-foreground/50">Last fetched at {lastFetch}</p>}

      {/* Log list */}
      {loading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Terminal size={32} />}
          title="No logs"
          description="System logs will appear here when agents run"
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/30">
                <div className="flex-shrink-0 mt-0.5">{LEVEL_ICONS[log.level]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <Badge variant={LEVEL_BADGE_VARIANT[log.level]}>{log.level}</Badge>
                    {log.agentId && (
                      <span className="text-xs text-muted-foreground/70">@{log.agentId}</span>
                    )}
                    {log.toolId && (
                      <span className="text-xs text-primary/70 font-mono">{log.toolId}</span>
                    )}
                    <span className="text-xs text-muted-foreground/50 ml-auto">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 font-mono break-words">{log.message}</p>
                  {(log.durationMs !== undefined || log.tokenCount !== undefined) && (
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground/50">
                      {log.durationMs !== undefined && <span>{fmtDuration(log.durationMs)}</span>}
                      {log.tokenCount !== undefined && <span>{log.tokenCount} tokens</span>}
                      {log.costUsd !== undefined && log.costUsd > 0 && (
                        <span>{fmtCost(log.costUsd)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'runs' | 'logs'

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('runs')

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Everything Halo has done — agent runs, tool usage, and system logs
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          { id: 'runs' as Tab, label: 'Agent Runs', icon: PlayCircle },
          { id: 'logs' as Tab, label: 'System Logs', icon: Terminal },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'runs' && <RunsTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  )
}
