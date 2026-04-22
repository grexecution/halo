'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, EmptyState, Input, Label, Select, Switch, cn } from '../components/ui/index'
import { RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Level badge
// ---------------------------------------------------------------------------

const LEVEL_BADGE_VARIANT: Record<LogLevel, 'info' | 'warning' | 'danger' | 'muted'> = {
  info: 'info',
  warn: 'warning',
  error: 'danger',
  debug: 'muted',
}

function LevelBadge({ level }: { level: LogLevel }) {
  return <Badge variant={LEVEL_BADGE_VARIANT[level]}>{level}</Badge>
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LogsPage() {
  const [level, setLevel] = useState<string>('')
  const [agentId, setAgentId] = useState<string>('')
  const [toolId, setToolId] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [knownAgents, setKnownAgents] = useState<string[]>([])
  const [knownTools, setKnownTools] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    if (agentId.trim()) params.set('agentId', agentId.trim())
    if (toolId.trim()) params.set('toolId', toolId.trim())
    params.set('limit', '200')

    try {
      const res = await fetch(`/api/logs?${params.toString()}`)
      const data = (await res.json()) as {
        logs: LogEntry[]
        agents: string[]
        tools: string[]
      }
      setLogs(data.logs ?? [])
      setKnownAgents(data.agents ?? [])
      setKnownTools(data.tools ?? [])
      setLastFetch(new Date().toLocaleTimeString())
    } catch {
      // control-plane not running
    } finally {
      setLoading(false)
    }
  }, [level, agentId, toolId])

  // Initial fetch
  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void fetchLogs(), 3000)
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, fetchLogs])

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Logs</h1>
          {loading && <RefreshCw size={14} className="text-gray-600 animate-spin" />}
          {lastFetch && !loading && (
            <span className="text-xs text-gray-600">updated {lastFetch}</span>
          )}
        </div>

        {/* Filters */}
        <div data-testid="log-filters" className="flex items-center gap-3 flex-wrap">
          <Select
            data-testid="level-filter"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-32"
          >
            <option value="">All levels</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
            <option value="debug">debug</option>
          </Select>

          {knownAgents.length > 0 ? (
            <Select
              data-testid="agent-filter"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-36"
            >
              <option value="">All agents</option>
              {knownAgents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              data-testid="agent-filter"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent id"
              className="w-36"
            />
          )}

          {knownTools.length > 0 ? (
            <Select
              data-testid="tool-filter"
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              className="w-36"
            >
              <option value="">All tools</option>
              {knownTools.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              data-testid="tool-filter"
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              placeholder="tool id"
              className="w-36"
            />
          )}

          <div className="flex items-center gap-2">
            <Label
              htmlFor="auto-refresh"
              className="text-xs text-gray-400 cursor-pointer select-none"
            >
              Live
            </Label>
            <Switch id="auto-refresh" checked={autoRefresh} onChange={setAutoRefresh} />
          </div>

          <button
            onClick={() => void fetchLogs()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Log table */}
      {!loading && logs.length === 0 ? (
        <EmptyState
          title="No logs yet"
          description="Logs appear here once the agent processes a message."
        />
      ) : (
        <div
          data-testid="log-table"
          className="overflow-y-auto h-[calc(100vh-12rem)] rounded-xl border border-gray-800 bg-gray-950"
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-44">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-20">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-28">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-28">Tool</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-24">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-20">
                  Tokens
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  data-testid={`log-row-${log.id}`}
                  className={cn(
                    'hover:bg-gray-900/60 transition-colors',
                    log.level === 'error' && 'bg-red-900/20',
                  )}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                    <span className="text-gray-700 ml-1 text-[10px]">
                      {new Date(log.timestamp).toLocaleDateString([], {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelBadge level={log.level} />
                  </td>
                  <td className="px-4 py-2.5">
                    {log.agentId ? (
                      <Badge variant="default">{log.agentId}</Badge>
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.toolId ? (
                      <Badge variant="muted">{log.toolId}</Badge>
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                    {log.durationMs !== undefined ? `${log.durationMs}ms` : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                    {log.tokenCount !== undefined ? log.tokenCount.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-300">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
