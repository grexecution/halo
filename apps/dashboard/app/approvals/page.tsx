'use client'

import { useEffect, useState, useCallback } from 'react'

interface Approval {
  id: string
  chatId: string | null
  agentId: string
  actionType: string
  description: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied'
  createdAt: string
  resolvedAt: string | null
}

const ACTION_ICONS: Record<string, string> = {
  shell_exec: '💻',
  fs_write: '📝',
  fs_delete: '🗑️',
  browser_navigate: '🌐',
  email_send: '📧',
  git_push: '🔀',
  default: '⚠️',
}

const STATUS_STYLES = {
  pending: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  approved: 'bg-green-500/10 border-green-500/30 text-green-400',
  denied: 'bg-red-500/10 border-red-500/30 text-red-400',
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied'>('pending')
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/approvals?status=${filter}`)
      .then((r) => r.json())
      .then((d: { approvals?: Approval[] }) => setApprovals(d.approvals ?? []))
      .catch(() => setApprovals([]))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    load()
    // Poll for new pending approvals every 3 s
    if (filter === 'pending') {
      const t = setInterval(load, 3_000)
      return () => clearInterval(t)
    }
  }, [filter, load])

  async function resolve(id: string, action: 'approve' | 'deny') {
    setResolving(id)
    try {
      await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      load()
    } finally {
      setResolving(null)
    }
  }

  const pendingCount = filter === 'pending' ? approvals.length : null

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            Approval Queue
            {pendingCount !== null && pendingCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Actions agents are waiting on you to approve or deny
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-md"
        >
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800 pb-1">
        {(['pending', 'approved', 'denied'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 text-sm rounded-t-md capitalize transition-colors ${
              filter === s
                ? 'text-white border-b-2 border-blue-500 -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-600">Loading…</div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-3">
          <span className="text-4xl">{filter === 'pending' ? '✅' : '📋'}</span>
          <p className="text-sm">
            {filter === 'pending'
              ? 'No pending approvals — agents are running freely'
              : `No ${filter} approvals`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className={`border rounded-xl p-4 ${STATUS_STYLES[a.status]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0 mt-0.5">
                    {ACTION_ICONS[a.actionType] ?? ACTION_ICONS.default}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs bg-gray-900/60 px-2 py-0.5 rounded border border-gray-700">
                        {a.actionType}
                      </span>
                      <span className="text-xs text-gray-500">
                        by <span className="text-gray-400 font-medium">@{a.agentId}</span>
                      </span>
                      {a.chatId && (
                        <a
                          href={`/chat?id=${a.chatId}`}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View chat →
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-gray-200 mt-1.5 leading-snug">{a.description}</p>
                    {Object.keys(a.payload).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                          Show payload
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-900/80 rounded p-2 overflow-x-auto text-gray-300 border border-gray-800">
                          {JSON.stringify(a.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                    <p className="text-xs text-gray-600 mt-2">
                      {new Date(a.createdAt).toLocaleString()}
                      {a.resolvedAt && ` · resolved ${new Date(a.resolvedAt).toLocaleString()}`}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {a.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => resolve(a.id, 'approve')}
                      disabled={resolving === a.id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Allow
                    </button>
                    <button
                      onClick={() => resolve(a.id, 'deny')}
                      disabled={resolving === a.id}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                )}
                {a.status !== 'pending' && (
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 capitalize ${
                      a.status === 'approved'
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-red-900/50 text-red-300'
                    }`}
                  >
                    {a.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
