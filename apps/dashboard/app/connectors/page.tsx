'use client'
import { useState } from 'react'

interface Connector {
  id: string
  name: string
  type: 'oauth' | 'api-key' | 'mcp'
  enabled: boolean
  lastUsed?: string | undefined
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([
    { id: 'gmail', name: 'Gmail', type: 'oauth', enabled: false },
    { id: 'github', name: 'GitHub', type: 'oauth', enabled: false },
    { id: 'gcal', name: 'Google Calendar', type: 'oauth', enabled: false },
  ])

  function toggleConnector(id: string) {
    setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)))
  }

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Connectors</h1>
      <ul data-testid="connector-list" className="space-y-2">
        {connectors.map((c) => (
          <li
            key={c.id}
            data-testid={`connector-${c.id}`}
            className="border rounded p-3 flex justify-between items-center"
          >
            <div>
              <span className="font-semibold">{c.name}</span>
              <span className="ml-2 text-xs text-gray-400">{c.type}</span>
            </div>
            <div className="flex items-center gap-3">
              {c.lastUsed && <span className="text-xs text-gray-400">Last: {c.lastUsed}</span>}
              <button
                data-testid={`toggle-${c.id}`}
                onClick={() => toggleConnector(c.id)}
                className={`px-3 py-1 rounded text-sm ${c.enabled ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
              >
                {c.enabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <button
          data-testid="add-connector-button"
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Add Connector
        </button>
      </div>
    </main>
  )
}
