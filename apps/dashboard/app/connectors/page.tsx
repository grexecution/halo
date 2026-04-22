'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ALL_PLUGINS,
  CATEGORY_LABELS,
  getPluginsByCategory,
  type Plugin,
  type PluginCategory,
} from '@open-greg/connectors/plugins'

// ── Shared constants ──────────────────────────────────────────────────────────

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

// Provider logo / icon fallback (emoji or first letter)
const PROVIDER_LOGOS: Record<string, string> = {
  anthropic: '✳',
  openai: '⬡',
  google_gemini: '◈',
  kimi: '🌙',
  deepseek: '🐬',
  xai_grok: '𝕏',
  mistral: '☁',
  groq: '⚡',
  together_ai: '∞',
  openrouter: '⊕',
  perplexity: '◎',
  cohere: '◉',
  cerebras: '◆',
  ollama: '🦙',
  azure_openai: '☁',
  amazon_bedrock: '☁',
  custom_openai_compatible: '+',
}

const MODEL_PLUGINS = ALL_PLUGINS.filter((p) => p.category === 'ai')
const OTHER_PLUGINS = ALL_PLUGINS.filter((p) => p.category !== 'ai')

// ── ConnectModal ──────────────────────────────────────────────────────────────

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
                  className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                >
                  How to get this →
                </a>
              )}
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>

        {plugin.setupUrl && (
          <div className="px-5 pb-4">
            <a
              href={plugin.setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Get API key / credentials →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PluginCard (for Plugins tab) ──────────────────────────────────────────────

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
      className={`relative bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${
        connected
          ? 'border-green-700/60 shadow-sm shadow-green-900/20'
          : 'border-gray-800 hover:border-gray-700'
      } ${isPlanned ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white text-sm truncate">{plugin.name}</span>
            {connected && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">
                ✓
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{plugin.description}</p>
        </div>
        <span
          className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[plugin.status]}`}
        >
          {plugin.status}
        </span>
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

// ── ModelCard (for Models tab) ────────────────────────────────────────────────

interface ModelCardProps {
  provider: Plugin
  connected: boolean
  onConnect: (plugin: Plugin) => void
  onDisconnect: (plugin: Plugin) => void
}

function ModelCard({ provider, connected, onConnect, onDisconnect }: ModelCardProps) {
  const isLocal = provider.connectionType === 'credentials'
  const logo = PROVIDER_LOGOS[provider.id] ?? provider.name[0]

  return (
    <div
      className={`relative bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${
        connected
          ? 'border-green-700/60 shadow-sm shadow-green-900/20'
          : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 ${
            connected
              ? 'bg-green-900/40 border border-green-800'
              : 'bg-gray-800 border border-gray-700'
          }`}
        >
          {logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{provider.name}</span>
            {connected && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800 shrink-0">
                active
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isLocal ? (
              <span className="text-xs text-gray-500">Local</span>
            ) : (
              <span className="text-xs text-gray-500">API key</span>
            )}
            <span className="text-gray-700">·</span>
            <span
              className={`text-xs ${
                provider.status === 'official' ? 'text-blue-400' : 'text-purple-400'
              }`}
            >
              {provider.status}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-500 text-xs leading-relaxed">{provider.description}</p>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {provider.docsUrl && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Docs
          </a>
        )}
        {connected ? (
          <button
            onClick={() => onDisconnect(provider)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={() => onConnect(provider)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
          >
            {isLocal ? 'Configure' : 'Add key'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── ModelsTab ─────────────────────────────────────────────────────────────────

interface ModelsTabProps {
  connected: Set<string>
  onConnect: (plugin: Plugin) => void
  onDisconnect: (plugin: Plugin) => void
}

function ModelsTab({ connected, onConnect, onDisconnect }: ModelsTabProps) {
  const cloud = MODEL_PLUGINS.filter(
    (p) => p.connectionType !== 'credentials' && p.id !== 'custom_openai_compatible',
  )
  const local = MODEL_PLUGINS.filter(
    (p) => p.connectionType === 'credentials' && p.id !== 'custom_openai_compatible',
  )
  const customPlugin = MODEL_PLUGINS.find((p) => p.id === 'custom_openai_compatible')

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">AI Models</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {connected.size} provider{connected.size !== 1 ? 's' : ''} configured
            </p>
          </div>
          {customPlugin && (
            <button
              onClick={() => onConnect(customPlugin)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Add custom server
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-8">
        {/* Cloud providers */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Cloud Providers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cloud.map((p) => (
              <ModelCard
                key={p.id}
                provider={p}
                connected={connected.has(p.id)}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            ))}
          </div>
        </section>

        {/* Local providers */}
        {local.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Local / Self-Hosted
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {local.map((p) => (
                <ModelCard
                  key={p.id}
                  provider={p}
                  connected={connected.has(p.id)}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                />
              ))}
            </div>
          </section>
        )}

        {/* Custom servers hint */}
        <section className="border border-dashed border-gray-700 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-300">Need a provider not listed here?</p>
            <p className="text-xs text-gray-500 mt-1">
              Add any OpenAI-compatible server — LM Studio, vLLM, llama.cpp, Jan, or a custom
              endpoint.
            </p>
          </div>
          {customPlugin && (
            <button
              onClick={() => onConnect(customPlugin)}
              className="shrink-0 px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-colors"
            >
              Add custom
            </button>
          )}
        </section>
      </div>
    </div>
  )
}

// ── PluginsTab ────────────────────────────────────────────────────────────────

interface PluginsTabProps {
  connected: Set<string>
  onConnect: (plugin: Plugin) => void
  onDisconnect: (plugin: Plugin) => void
}

function PluginsTab({ connected, onConnect, onDisconnect }: PluginsTabProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<PluginCategory | 'all'>('all')

  const categoryMap = getPluginsByCategory()
  // Only show non-AI categories in plugins tab
  const categories = Array.from(categoryMap.keys()).filter((c) => c !== 'ai')

  const filtered = OTHER_PLUGINS.filter((p) => {
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

  const connectedPluginCount = Array.from(connected).filter((id) =>
    OTHER_PLUGINS.some((p) => p.id === id),
  ).length
  const totalPluginCount = OTHER_PLUGINS.filter((p) => p.status !== 'planned').length

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Category sidebar */}
      <aside className="w-48 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto">
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
              <span className="ml-auto text-xs text-gray-600">{OTHER_PLUGINS.length}</span>
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
        <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Plugins</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {connectedPluginCount} of {totalPluginCount} connected
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
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ConnectorsPage ────────────────────────────────────────────────────────────

type Tab = 'models' | 'plugins'

export default function ConnectorsPage() {
  const [tab, setTab] = useState<Tab>('models')
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null)
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  const modelConnectedCount = Array.from(connected).filter((id) =>
    MODEL_PLUGINS.some((p) => p.id === id),
  ).length

  return (
    <div className="flex flex-col h-full">
      {/* Top tab bar */}
      <div className="flex items-end gap-0 border-b border-gray-800 px-6 bg-gray-950 shrink-0">
        <button
          onClick={() => setTab('models')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'models'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          AI Models
          {modelConnectedCount > 0 && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300">
              {modelConnectedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('plugins')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'plugins'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Plugins
        </button>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'models' ? (
          <ModelsTab
            connected={
              new Set(Array.from(connected).filter((id) => MODEL_PLUGINS.some((p) => p.id === id)))
            }
            onConnect={setActivePlugin}
            onDisconnect={(p) => void handleDisconnect(p)}
          />
        ) : (
          <PluginsTab
            connected={connected}
            onConnect={setActivePlugin}
            onDisconnect={(p) => void handleDisconnect(p)}
          />
        )}
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
