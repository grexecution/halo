'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ALL_PLUGINS,
  CATEGORY_LABELS,
  getPluginsByCategory,
  type Plugin,
  type PluginCategory,
} from '@claw-alt/connectors/plugins'

const CATEGORY_ICONS: Record<PluginCategory, string> = {
  workspace: '🏢',
  project_management: '📋',
  communication: '💬',
  crm: '🤝',
  development: '💻',
  storage: '🗄️',
  analytics: '📊',
  email_marketing: '📧',
  calendar: '📅',
  finance: '💰',
  seo: '🔍',
  hosting: '🚀',
  database: '🗃️',
  ai: '🤖',
}

const STATUS_BADGE: Record<Plugin['status'], string> = {
  official: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  beta: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  community: 'bg-purple-900/50 text-purple-300 border border-purple-700',
  planned: 'bg-gray-800 text-gray-500 border border-gray-700',
}

interface ConnectModalProps {
  plugin: Plugin
  onClose: () => void
  onSave: (fields: Record<string, string>) => Promise<void>
}

function ConnectModal({ plugin, onClose, onSave }: ConnectModalProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing = plugin.fields.filter((f) => f.required && !values[f.key]?.trim())
    if (missing.length > 0) {
      setError(`Required: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(values)
    } catch {
      setError('Failed to save credentials')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-lg">{plugin.name}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{plugin.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          {plugin.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {field.type === 'select' && field.options ? (
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                />
              )}
              {field.helpUrl && (
                <a
                  href={field.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline mt-1 block"
                >
                  How to get this →
                </a>
              )}
            </div>
          ))}

          {plugin.connectionType === 'oauth' && plugin.fields.length === 0 && (
            <p className="text-sm text-gray-400">
              This connector uses OAuth. Click Connect to authorize via browser.
            </p>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium"
            >
              {saving ? 'Saving…' : 'Connect'}
            </button>
          </div>
        </form>

        {plugin.docsUrl && (
          <div className="px-5 pb-4">
            <a
              href={plugin.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              View documentation →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

interface PluginCardProps {
  plugin: Plugin
  connected: boolean
  onConnect: (plugin: Plugin) => void
  onDisconnect: (plugin: Plugin) => void
}

function PluginCard({ plugin, connected, onConnect, onDisconnect }: PluginCardProps) {
  const isPlanned = plugin.status === 'planned'

  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
        connected ? 'border-green-700' : 'border-gray-800 hover:border-gray-700'
      } ${isPlanned ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-medium text-sm truncate">{plugin.name}</h3>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${STATUS_BADGE[plugin.status]}`}
            >
              {plugin.status}
            </span>
            {connected && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-700">
                ✓ connected
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{plugin.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded font-mono">
          {plugin.connectionType}
        </span>
        {plugin.mcpPackage && (
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded font-mono truncate">
            {plugin.mcpPackage}
          </span>
        )}
      </div>

      {!isPlanned && (
        <div className="flex gap-2">
          {connected ? (
            <button
              onClick={() => onDisconnect(plugin)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => onConnect(plugin)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
            >
              Connect
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConnectorsPage() {
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<PluginCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)

  const loadConnected = useCallback(async () => {
    try {
      const res = await fetch('/api/plugins')
      const data = (await res.json()) as { connected: string[] }
      setConnected(new Set(data.connected))
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConnected()
  }, [loadConnected])

  async function handleSave(fields: Record<string, string>) {
    if (!activePlugin) return
    await fetch(`/api/plugins/${activePlugin.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    setConnected((prev) => new Set([...prev, activePlugin.id]))
    setActivePlugin(null)
  }

  async function handleDisconnect(plugin: Plugin) {
    await fetch(`/api/plugins/${plugin.id}`, { method: 'DELETE' })
    setConnected((prev) => {
      const next = new Set(prev)
      next.delete(plugin.id)
      return next
    })
  }

  const categoryMap = getPluginsByCategory()
  const categories = Array.from(categoryMap.keys())

  const filtered = ALL_PLUGINS.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const grouped = new Map<PluginCategory, Plugin[]>()
  for (const p of filtered) {
    const list = grouped.get(p.category) ?? []
    list.push(p)
    grouped.set(p.category, list)
  }

  const connectedCount = connected.size
  const totalCount = ALL_PLUGINS.filter((p) => p.status !== 'planned').length

  return (
    <div className="flex h-full">
      {/* Left sidebar — category filter */}
      <aside className="w-48 flex-shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto">
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Categories</p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                activeCategory === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              <span>🔌</span>
              <span>All plugins</span>
              <span className="ml-auto text-xs text-gray-600">{ALL_PLUGINS.length}</span>
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  activeCategory === cat
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <span>{CATEGORY_ICONS[cat]}</span>
                <span className="truncate">{CATEGORY_LABELS[cat]}</span>
                <span className="ml-auto text-xs text-gray-600">
                  {categoryMap.get(cat)?.length ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Plugin Marketplace</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {loading ? '…' : `${connectedCount} of ${totalCount} connected`}
              </p>
            </div>
            <input
              type="search"
              placeholder="Search plugins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
        </div>

        {/* Plugin grid */}
        <div className="px-6 py-5 space-y-8">
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm">No plugins match your search.</p>
          )}

          {Array.from(grouped.entries()).map(([cat, plugins]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{CATEGORY_ICONS[cat]}</span>
                {CATEGORY_LABELS[cat]}
                <span className="text-gray-700 font-normal normal-case tracking-normal">
                  ({plugins.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {plugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    connected={connected.has(plugin.id)}
                    onConnect={setActivePlugin}
                    onDisconnect={(p) => void handleDisconnect(p)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {activePlugin && (
        <ConnectModal
          plugin={activePlugin}
          onClose={() => setActivePlugin(null)}
          onSave={(fields) => handleSave(fields)}
        />
      )}
    </div>
  )
}
