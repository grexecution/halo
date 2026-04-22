'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Instance {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'unknown'
  lastSeen?: string
  version?: string
  agentCount?: number
  activeGoals?: number
  llmModel?: string
}

export default function HubPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/hub/instances')
      .then((r) => r.json())
      .then((data: { instances: Instance[] }) => {
        setInstances(data.instances ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Instance Hub</h1>
          <p className="mt-1 text-sm text-gray-400">
            Control all your claw-alt instances from one place.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-sm rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Discovering instances…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <InstanceCard key={inst.id} instance={inst} />
          ))}

          <AddInstanceCard />
        </div>
      )}
    </div>
  )
}

function InstanceCard({ instance }: { instance: Instance }) {
  const statusColor =
    instance.status === 'online'
      ? 'bg-green-500'
      : instance.status === 'offline'
        ? 'bg-red-500'
        : 'bg-yellow-500'

  const isLocal = instance.url.includes('localhost') || instance.url.includes('127.0.0.1')

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            <h2 className="font-semibold text-white">{instance.name}</h2>
            {isLocal && (
              <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                local
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{instance.url}</p>
        </div>
        {instance.version && (
          <span className="text-xs text-gray-600 font-mono">v{instance.version}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Agents" value={instance.agentCount ?? '—'} />
        <Stat label="Goals" value={instance.activeGoals ?? '—'} />
        <Stat label="Model" value={instance.llmModel ?? '—'} small />
      </div>

      {instance.lastSeen && (
        <p className="text-xs text-gray-600 mb-4">Last seen: {instance.lastSeen}</p>
      )}

      <div className="flex gap-2">
        {isLocal ? (
          <Link
            href="/chat"
            className="flex-1 text-center text-sm bg-indigo-700 hover:bg-indigo-600 text-white py-1.5 rounded-lg transition-colors"
          >
            Open Dashboard
          </Link>
        ) : (
          <a
            href={`${instance.url}/hub`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded-lg transition-colors"
          >
            Open Remote →
          </a>
        )}
        {instance.status === 'online' && (
          <button className="px-3 py-1.5 text-sm bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded-lg transition-colors">
            Pause
          </button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="bg-gray-900/60 rounded-lg p-2 text-center">
      <div className={`font-semibold text-white ${small ? 'text-xs truncate' : 'text-lg'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function AddInstanceCard() {
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleAdd() {
    if (!url.trim()) return
    setAdding(true)
    await fetch('/api/hub/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {})
    setAdding(false)
    setOpen(false)
    setUrl('')
    window.location.reload()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-5 text-gray-500 hover:text-gray-300 transition-colors flex flex-col items-center justify-center gap-2 min-h-[180px]"
      >
        <span className="text-3xl">+</span>
        <span className="text-sm">Add instance</span>
      </button>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <h3 className="font-semibold text-white mb-3">Connect instance</h3>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-server.com"
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 mb-3 focus:outline-none focus:border-indigo-500"
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm py-1.5 rounded-lg"
        >
          {adding ? 'Connecting…' : 'Connect'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
