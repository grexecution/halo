'use client'
import { useState } from 'react'

interface LogEntry {
  id: string
  level: 'info' | 'warn' | 'error'
  message: string
  agentId?: string | undefined
  toolId?: string | undefined
  traceId?: string | undefined
  timestamp: string
}

export default function LogsPage() {
  const [filter, setFilter] = useState({ level: '', agentId: '', toolId: '' })
  const [logs] = useState<LogEntry[]>([
    {
      id: '1',
      level: 'info',
      message: 'Agent started',
      agentId: 'claw',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      level: 'error',
      message: 'Tool call failed: timeout',
      toolId: 'shell_exec',
      timestamp: new Date().toISOString(),
    },
  ])

  const filtered = logs.filter((log) => {
    if (filter.level && log.level !== filter.level) return false
    if (filter.agentId && log.agentId !== filter.agentId) return false
    if (filter.toolId && log.toolId !== filter.toolId) return false
    return true
  })

  return (
    <main className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Logs</h1>
      <div className="flex gap-2 mb-4" data-testid="log-filters">
        <select
          data-testid="level-filter"
          className="border rounded px-2 py-1"
          value={filter.level}
          onChange={(e) => setFilter((prev) => ({ ...prev, level: e.target.value }))}
        >
          <option value="">All levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <input
          data-testid="agent-filter"
          className="border rounded px-2 py-1"
          placeholder="Agent ID"
          value={filter.agentId}
          onChange={(e) => setFilter((prev) => ({ ...prev, agentId: e.target.value }))}
        />
        <input
          data-testid="tool-filter"
          className="border rounded px-2 py-1"
          placeholder="Tool ID"
          value={filter.toolId}
          onChange={(e) => setFilter((prev) => ({ ...prev, toolId: e.target.value }))}
        />
      </div>

      <table data-testid="log-table" className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2 border">Time</th>
            <th className="p-2 border">Level</th>
            <th className="p-2 border">Message</th>
            <th className="p-2 border">Agent</th>
            <th className="p-2 border">Tool</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log) => (
            <tr
              key={log.id}
              data-testid={`log-row-${log.id}`}
              className={log.level === 'error' ? 'bg-red-50' : ''}
            >
              <td className="p-2 border text-xs font-mono">{log.timestamp}</td>
              <td
                className={`p-2 border font-semibold ${log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-yellow-600' : 'text-gray-600'}`}
              >
                {log.level}
              </td>
              <td className="p-2 border">{log.message}</td>
              <td className="p-2 border text-gray-500">{log.agentId ?? '-'}</td>
              <td className="p-2 border text-gray-500">{log.toolId ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div data-testid="no-logs" className="text-center text-gray-400 mt-4">
          No logs match current filters
        </div>
      )}
    </main>
  )
}
