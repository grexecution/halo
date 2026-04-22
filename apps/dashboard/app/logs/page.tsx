'use client'

// NOTE: /api/logs does not exist yet. This page uses mock data until the
// control-plane is running and the route is implemented.

import { useEffect, useRef, useState } from 'react'
import { Badge, EmptyState, Input, Label, Select, Switch, cn } from '../components/ui/index'

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
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    timestamp: '2026-04-22T08:00:01.000Z',
    level: 'info',
    message: 'Agent started successfully',
    agentId: 'claw',
  },
  {
    id: '2',
    timestamp: '2026-04-22T08:00:02.312Z',
    level: 'debug',
    message: 'Loading LLM model: claude-sonnet-4-6',
    agentId: 'claw',
  },
  {
    id: '3',
    timestamp: '2026-04-22T08:00:03.774Z',
    level: 'info',
    message: 'Goal created: research open-source alternatives',
    agentId: 'claw',
    toolId: 'goal_manager',
  },
  {
    id: '4',
    timestamp: '2026-04-22T08:00:05.120Z',
    level: 'info',
    message: 'Shell tool invoked',
    agentId: 'claw',
    toolId: 'shell',
  },
  {
    id: '5',
    timestamp: '2026-04-22T08:00:05.988Z',
    level: 'warn',
    message: 'Shell command took longer than threshold (5s)',
    agentId: 'claw',
    toolId: 'shell',
  },
  {
    id: '6',
    timestamp: '2026-04-22T08:00:08.001Z',
    level: 'error',
    message: 'Tool call failed: timeout after 10000ms',
    agentId: 'claw',
    toolId: 'browser',
  },
  {
    id: '7',
    timestamp: '2026-04-22T08:00:09.450Z',
    level: 'info',
    message: 'Retrying browser tool with reduced timeout',
    agentId: 'claw',
    toolId: 'browser',
  },
  {
    id: '8',
    timestamp: '2026-04-22T08:00:11.002Z',
    level: 'debug',
    message: 'Memory write: stored 3 new facts',
    agentId: 'planner',
  },
  {
    id: '9',
    timestamp: '2026-04-22T08:00:13.780Z',
    level: 'error',
    message: 'Filesystem read denied: path outside sandbox',
    agentId: 'planner',
    toolId: 'filesystem',
  },
  {
    id: '10',
    timestamp: '2026-04-22T08:00:15.991Z',
    level: 'info',
    message: 'Agent checkpoint saved',
    agentId: 'planner',
  },
]

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
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Simulate a fetch — replace with real fetch('/api/logs?...') when available
  function fetchLogs() {
    // TODO: replace with real API call once control-plane is running:
    // fetch(`/api/logs?level=${level}&agentId=${agentId}&toolId=${toolId}&limit=100`)
    //   .then(r => r.json())
    //   .then(data => setLogs(data.logs ?? []))
    setLogs(MOCK_LOGS)
  }

  // Auto-refresh: re-fetch every 5 seconds when enabled
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000)
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
  }, [autoRefresh])

  const filtered = logs.filter((log) => {
    if (level && log.level !== level) return false
    if (agentId.trim() && log.agentId !== agentId.trim()) return false
    if (toolId.trim() && log.toolId !== toolId.trim()) return false
    return true
  })

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Logs</h1>

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

          <Input
            data-testid="agent-filter"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="agent id"
            className="w-36"
          />

          <Input
            data-testid="tool-filter"
            value={toolId}
            onChange={(e) => setToolId(e.target.value)}
            placeholder="tool id"
            className="w-36"
          />

          <div className="flex items-center gap-2">
            <Label
              htmlFor="auto-refresh"
              className="text-xs text-gray-400 cursor-pointer select-none"
            >
              Live
            </Label>
            <Switch id="auto-refresh" checked={autoRefresh} onChange={setAutoRefresh} />
          </div>
        </div>
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No logs match the current filters"
          description="Adjust the level, agent, or tool filters above."
        />
      ) : (
        <div
          data-testid="log-table"
          className="overflow-y-auto h-[calc(100vh-12rem)] rounded-xl border border-gray-800 bg-gray-950"
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap w-48">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-20">
                  Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-28">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-28">Tool</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  data-testid={`log-row-${log.id}`}
                  className={cn(
                    'hover:bg-gray-900/60 transition-colors',
                    log.level === 'error' && 'bg-red-900/20',
                  )}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {log.timestamp}
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
