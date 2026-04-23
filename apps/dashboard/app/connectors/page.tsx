'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ALL_PLUGINS,
  CATEGORY_LABELS,
  getPluginsByCategory,
  type Plugin,
  type PluginCategory,
} from '@open-greg/connectors/plugins'
import {
  MCP_SERVERS,
  MCP_CATEGORY_LABELS,
  getMcpsByCategory,
  type McpServer,
  type McpCategory,
} from '@open-greg/connectors/mcps'
import {
  DEFAULT_SKILLS,
  SKILL_CATEGORY_LABELS,
  getSkillsByCategory,
  type Skill,
  type SkillCategory,
} from '@open-greg/connectors/skills'

// ── Shared ────────────────────────────────────────────────────────────────────

type Tab = 'models' | 'plugins' | 'mcps' | 'skills'

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

const MCP_CATEGORY_ICONS: Record<McpCategory, string> = {
  filesystem: '📁',
  browser: '🌐',
  database: '🗃️',
  development: '💻',
  communication: '💬',
  productivity: '📋',
  search: '🔍',
  ai: '🤖',
  media: '🎨',
  devops: '🚀',
  data: '📊',
  security: '🔒',
}

const SKILL_CATEGORY_ICONS: Record<SkillCategory, string> = {
  writing: '✍️',
  coding: '💻',
  research: '🔬',
  productivity: '⚡',
  data: '📊',
  communication: '💬',
  creative: '🎨',
  analysis: '🔎',
  devops: '🚀',
  marketing: '📣',
}

const STATUS_BADGE: Record<string, string> = {
  official: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  verified: 'bg-green-900/50 text-green-300 border border-green-700',
  beta: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  community: 'bg-purple-900/50 text-purple-300 border border-purple-700',
  planned: 'bg-gray-800 text-gray-500 border border-gray-700',
}

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

// ── Generic modal ─────────────────────────────────────────────────────────────

interface ModalField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'email' | 'select' | 'textarea'
  required: boolean
  placeholder?: string
  options?: string[]
  helpUrl?: string
}

interface GenericModalProps {
  title: string
  subtitle?: string
  fields: ModalField[]
  initialValues?: Record<string, string>
  submitLabel?: string
  footerLink?: { label: string; href: string } | undefined
  onClose: () => void
  onSave: (values: Record<string, string>) => Promise<void>
}

function GenericModal({
  title,
  subtitle,
  fields,
  initialValues = {},
  submitLabel = 'Save',
  footerLink,
  onClose,
  onSave,
}: GenericModalProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const missing = fields.filter((f) => f.required && !values[f.key]?.trim())
    if (missing.length > 0) {
      setError(`Required: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(values)
    } catch {
      setError('Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-lg">{title}</h2>
            {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none mt-0.5 ml-4"
          >
            ×
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          {fields.map((field) => (
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
              ) : field.type === 'textarea' ? (
                <textarea
                  rows={5}
                  placeholder={field.placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                />
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
              {saving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
        {footerLink && (
          <div className="px-5 pb-4">
            <a
              href={footerLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {footerLink.label} →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── AI Models tab ─────────────────────────────────────────────────────────────

interface ModelsTabProps {
  connected: Set<string>
  onConnect: (plugin: Plugin) => void
  onDisconnect: (plugin: Plugin) => void
}

function ModelCard({
  provider,
  connected,
  onConnect,
  onDisconnect,
}: {
  provider: Plugin
  connected: boolean
  onConnect: (p: Plugin) => void
  onDisconnect: (p: Plugin) => void
}) {
  const isLocal = provider.connectionType === 'credentials'
  const logo = PROVIDER_LOGOS[provider.id] ?? provider.name[0]
  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${connected ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-gray-800 hover:border-gray-700'}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 ${connected ? 'bg-green-900/40 border border-green-800' : 'bg-gray-800 border border-gray-700'}`}
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
            <span className="text-xs text-gray-500">{isLocal ? 'Local' : 'API key'}</span>
            <span className="text-gray-700">·</span>
            <span
              className={`text-xs ${provider.status === 'official' ? 'text-blue-400' : 'text-purple-400'}`}
            >
              {provider.status}
            </span>
          </div>
        </div>
      </div>
      <p className="text-gray-500 text-xs leading-relaxed">{provider.description}</p>
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
              <span className="text-lg leading-none">+</span>Custom server
            </button>
          )}
        </div>
      </div>
      <div className="px-6 py-5 space-y-8">
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
        <section className="border border-dashed border-gray-700 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-300">Need a provider not listed?</p>
            <p className="text-xs text-gray-500 mt-1">
              Add any OpenAI-compatible server — LM Studio, vLLM, llama.cpp, Jan, or custom
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

// ── Plugins tab ───────────────────────────────────────────────────────────────

interface PluginsTabProps {
  connected: Set<string>
  onConnect: (plugin: Plugin) => void
  onDisconnect: (plugin: Plugin) => void
  customPlugins: CustomPluginDef[]
  onCreateCustomPlugin: () => void
  onDeleteCustomPlugin: (id: string) => void
  onConnectCustom: (plugin: CustomPluginDef) => void
  onDisconnectCustom: (id: string) => void
  connectedCustom: Set<string>
}

interface CustomPluginDef {
  id: string
  name: string
  description: string
  docs_url: string
  usage_note: string
  fieldsSchema: {
    key: string
    label: string
    type: string
    required: boolean
    placeholder?: string
  }[]
}

function PluginCard({
  plugin,
  connected,
  onConnect,
  onDisconnect,
}: {
  plugin: Plugin
  connected: boolean
  onConnect: (p: Plugin) => void
  onDisconnect: (p: Plugin) => void
}) {
  const isPlanned = plugin.status === 'planned'
  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${connected ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-gray-800 hover:border-gray-700'} ${isPlanned ? 'opacity-50' : ''}`}
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
      {plugin.docsUrl && (
        <a
          href={plugin.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          Docs →
        </a>
      )}
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

function CustomPluginCard({
  plugin,
  connected,
  onConnect,
  onDelete,
}: {
  plugin: CustomPluginDef
  connected: boolean
  onConnect: (p: CustomPluginDef) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${connected ? 'border-green-700/60' : 'border-gray-700 border-dashed hover:border-gray-600'}`}
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
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              custom
            </span>
          </div>
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
            {plugin.description || 'No description'}
          </p>
        </div>
      </div>
      {plugin.docs_url && (
        <a
          href={plugin.docs_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline"
        >
          Docs →
        </a>
      )}
      {plugin.usage_note && (
        <p className="text-xs text-gray-600 italic line-clamp-2">{plugin.usage_note}</p>
      )}
      <div className="flex gap-2">
        {connected ? (
          <button
            onClick={() => onDelete(plugin.id)}
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
        <button
          onClick={() => onDelete(plugin.id)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function PluginsTab({
  connected,
  onConnect,
  onDisconnect,
  customPlugins,
  onCreateCustomPlugin,
  onDeleteCustomPlugin,
  onConnectCustom,
  onDisconnectCustom: _onDisconnectCustom,
  connectedCustom,
}: PluginsTabProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<PluginCategory | 'all'>('all')
  const categoryMap = getPluginsByCategory()
  const categories = Array.from(categoryMap.keys()).filter((c) => c !== 'ai')
  const filtered = OTHER_PLUGINS.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (activeCategory === 'all' || p.category === activeCategory)
  })
  const grouped = new Map<PluginCategory, Plugin[]>()
  for (const p of filtered) {
    const list = grouped.get(p.category) ?? []
    list.push(p)
    grouped.set(p.category, list)
  }
  const connectedCount = Array.from(connected).filter((id) =>
    OTHER_PLUGINS.some((p) => p.id === id),
  ).length

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-48 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto">
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Categories</p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === 'all' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
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
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === cat ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
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
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Plugins</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {connectedCount} of {OTHER_PLUGINS.filter((p) => p.status !== 'planned').length}{' '}
                connected
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="search"
                placeholder="Search plugins…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-56"
              />
              <button
                onClick={onCreateCustomPlugin}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <span>+</span> Custom
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-8">
          {customPlugins.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                🔧 Custom Plugins{' '}
                <span className="text-gray-700 font-normal normal-case tracking-normal">
                  ({customPlugins.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {customPlugins.map((p) => (
                  <CustomPluginCard
                    key={p.id}
                    plugin={p}
                    connected={connectedCustom.has(p.id)}
                    onConnect={onConnectCustom}
                    onDelete={onDeleteCustomPlugin}
                  />
                ))}
              </div>
            </section>
          )}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm">No plugins match your search.</p>
          )}
          {Array.from(grouped.entries()).map(([cat, plugins]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{CATEGORY_ICONS[cat]}</span>
                {CATEGORY_LABELS[cat]}{' '}
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

// ── MCPs tab ──────────────────────────────────────────────────────────────────

interface InstalledMcp {
  id: string
  catalog_id: string | null
  name: string
  package: string | null
  url: string | null
  transport: string
  env: Record<string, string>
  args: string[]
  status: string
}

interface McpConfigModalProps {
  server: McpServer
  onClose: () => void
  onInstall: (env: Record<string, string>, args: string[]) => Promise<void>
}

function McpConfigModal({ server, onClose, onInstall }: McpConfigModalProps) {
  const fields: ModalField[] = (server.env ?? []).map((f) => ({
    key: f.key,
    label: f.label,
    type: 'password' as const,
    required: f.required,
    ...(f.placeholder !== undefined ? { placeholder: f.placeholder } : {}),
  }))
  return (
    <GenericModal
      title={`Install: ${server.name}`}
      subtitle={server.description}
      fields={fields}
      submitLabel="Install"
      footerLink={server.docsUrl ? { label: 'View docs', href: server.docsUrl } : undefined}
      onClose={onClose}
      onSave={async (values) => {
        const env: Record<string, string> = {}
        for (const f of server.env ?? []) {
          const v = values[f.key]
          if (v) env[f.key] = v
        }
        await onInstall(env, server.args ?? [])
      }}
    />
  )
}

function McpCard({
  server,
  installed,
  onInstall,
  onUninstall,
}: {
  server: McpServer
  installed: InstalledMcp | undefined
  onInstall: (s: McpServer) => void
  onUninstall: (id: string) => void
}) {
  const hasEnv = (server.env ?? []).length > 0
  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${installed ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-gray-800 hover:border-gray-700'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-white text-sm">{server.name}</span>
            {installed && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">
                installed
              </span>
            )}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[server.status]}`}
            >
              {server.status}
            </span>
          </div>
          <p className="text-gray-500 text-xs leading-relaxed">{server.description}</p>
        </div>
      </div>
      {server.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {server.tools.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono"
            >
              {t}
            </span>
          ))}
          {server.tools.length > 4 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
              +{server.tools.length - 4}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2 mt-auto">
        {server.docsUrl && (
          <a
            href={server.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Docs
          </a>
        )}
        {server.githubUrl && (
          <a
            href={server.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            GitHub
          </a>
        )}
        {installed ? (
          <button
            onClick={() => onUninstall(installed.id)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
          >
            Uninstall
          </button>
        ) : (
          <button
            onClick={() => onInstall(server)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
          >
            {hasEnv ? 'Configure & Install' : 'Install'}
          </button>
        )}
      </div>
    </div>
  )
}

interface McpsTabProps {
  installed: InstalledMcp[]
  onInstall: (
    catalogId: string,
    name: string,
    pkg: string | undefined,
    url: string | undefined,
    transport: string,
    env: Record<string, string>,
    args: string[],
  ) => Promise<void>
  onUninstall: (id: string) => void
}

function McpsTab({ installed, onInstall, onUninstall }: McpsTabProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<McpCategory | 'all'>('all')
  const [configuringServer, setConfiguringServer] = useState<McpServer | null>(null)
  const [showCustom, setShowCustom] = useState(false)

  const categoryMap = getMcpsByCategory()
  const categories = Array.from(categoryMap.keys())
  const filtered = MCP_SERVERS.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (activeCategory === 'all' || s.category === activeCategory)
  })
  const grouped = new Map<McpCategory, McpServer[]>()
  for (const s of filtered) {
    const list = grouped.get(s.category) ?? []
    list.push(s)
    grouped.set(s.category, list)
  }

  function handleInstallClick(server: McpServer) {
    if ((server.env ?? []).length > 0) {
      setConfiguringServer(server)
    } else {
      void onInstall(
        server.id,
        server.name,
        server.package,
        server.url,
        server.transport,
        {},
        server.args ?? [],
      )
    }
  }

  const customInstallFields: ModalField[] = [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'My Custom MCP' },
    {
      key: 'package',
      label: 'npm Package',
      type: 'text',
      required: false,
      placeholder: 'my-mcp-server',
    },
    {
      key: 'url',
      label: 'OR Remote URL (SSE/HTTP)',
      type: 'url',
      required: false,
      placeholder: 'https://mcp.example.com/sse',
    },
    {
      key: 'transport',
      label: 'Transport',
      type: 'select',
      required: true,
      options: ['stdio', 'sse', 'http'],
    },
  ]

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-48 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto">
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Categories</p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === 'all' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              <span>🔌</span>
              <span>All servers</span>
              <span className="ml-auto text-xs text-gray-600">{MCP_SERVERS.length}</span>
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === cat ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
              >
                <span>{MCP_CATEGORY_ICONS[cat]}</span>
                <span className="truncate">{MCP_CATEGORY_LABELS[cat]}</span>
                <span className="ml-auto text-xs text-gray-600">
                  {categoryMap.get(cat)?.length ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">MCP Servers</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {installed.length} installed · give agents new tools
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="search"
                placeholder="Search MCPs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-56"
              />
              <button
                onClick={() => setShowCustom(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <span>+</span> Custom
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-8">
          {Array.from(grouped.entries()).map(([cat, servers]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{MCP_CATEGORY_ICONS[cat]}</span>
                {MCP_CATEGORY_LABELS[cat]}{' '}
                <span className="text-gray-700 font-normal normal-case tracking-normal">
                  ({servers.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {servers.map((s) => (
                  <McpCard
                    key={s.id}
                    server={s}
                    installed={installed.find((i) => i.catalog_id === s.id)}
                    onInstall={handleInstallClick}
                    onUninstall={onUninstall}
                  />
                ))}
              </div>
            </section>
          ))}
          <section className="border border-dashed border-gray-700 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-300">Don't see the MCP you need?</p>
              <p className="text-xs text-gray-500 mt-1">
                Add any MCP server by npm package name or remote SSE/HTTP URL. Browse{' '}
                <a
                  href="https://www.pulsemcp.com/servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  PulseMCP
                </a>{' '}
                or{' '}
                <a
                  href="https://github.com/wong2/awesome-mcp-servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Awesome MCP Servers
                </a>
                .
              </p>
            </div>
            <button
              onClick={() => setShowCustom(true)}
              className="shrink-0 px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-colors"
            >
              Add custom
            </button>
          </section>
        </div>
      </div>
      {configuringServer && (
        <McpConfigModal
          server={configuringServer}
          onClose={() => setConfiguringServer(null)}
          onInstall={async (env, args) => {
            await onInstall(
              configuringServer.id,
              configuringServer.name,
              configuringServer.package,
              configuringServer.url,
              configuringServer.transport,
              env,
              args,
            )
            setConfiguringServer(null)
          }}
        />
      )}
      {showCustom && (
        <GenericModal
          title="Add Custom MCP Server"
          subtitle="Any npm package or remote SSE/HTTP endpoint"
          fields={customInstallFields}
          submitLabel="Install"
          footerLink={{
            label: 'Browse PulseMCP directory',
            href: 'https://www.pulsemcp.com/servers',
          }}
          onClose={() => setShowCustom(false)}
          onSave={async (values) => {
            await onInstall(
              'custom',
              values.name ?? 'Custom MCP',
              values.package ?? undefined,
              values.url ?? undefined,
              values.transport ?? 'stdio',
              {},
              [],
            )
            setShowCustom(false)
          }}
        />
      )}
    </div>
  )
}

// ── Skills tab ────────────────────────────────────────────────────────────────

interface UserSkillDef {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  system_prompt: string
  steps: { title: string; prompt: string }[]
  example_trigger: string
  docs_url: string
  builtin: false
}

interface SkillsTabProps {
  userSkills: UserSkillDef[]
  onCreateSkill: (skill: {
    name: string
    description: string
    category: string
    systemPrompt: string
    exampleTrigger: string
  }) => Promise<void>
  onDeleteSkill: (id: string) => Promise<void>
}

function SkillCard({
  skill,
  onDelete,
  builtin,
}: {
  skill: Skill | UserSkillDef
  onDelete?: (id: string) => void
  builtin: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const category = skill.category as SkillCategory
  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 flex flex-col gap-2.5 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{SKILL_CATEGORY_ICONS[category] ?? '⚡'}</span>
            <span className="font-semibold text-white text-sm truncate">{skill.name}</span>
            {builtin && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-800">
                built-in
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs leading-relaxed">{skill.description}</p>
        </div>
      </div>
      {'example_trigger' in skill && skill.example_trigger ? (
        <p className="text-xs text-gray-600 italic">e.g. &ldquo;{skill.example_trigger}&rdquo;</p>
      ) : 'exampleTrigger' in skill && (skill as Skill).exampleTrigger ? (
        <p className="text-xs text-gray-600 italic">
          e.g. &ldquo;{(skill as Skill).exampleTrigger}&rdquo;
        </p>
      ) : null}
      {expanded && (
        <pre className="text-xs text-gray-400 bg-gray-800 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
          {'systemPrompt' in skill ? skill.systemPrompt : skill.system_prompt}
        </pre>
      )}
      <div className="flex gap-2 flex-wrap mt-auto">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
        >
          {expanded ? 'Hide prompt' : 'View prompt'}
        </button>
        {'docsUrl' in skill && skill.docsUrl && (
          <a
            href={skill.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Docs
          </a>
        )}
        {'docs_url' in skill && skill.docs_url && (
          <a
            href={skill.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Docs
          </a>
        )}
        {!builtin && onDelete && (
          <button
            onClick={() => onDelete(skill.id)}
            className="ml-auto px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

const CREATE_SKILL_FIELDS: ModalField[] = [
  {
    key: 'name',
    label: 'Skill Name',
    type: 'text',
    required: true,
    placeholder: 'e.g. Write weekly report',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'text',
    required: false,
    placeholder: 'What does this skill do?',
  },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    options: [
      'writing',
      'coding',
      'research',
      'productivity',
      'data',
      'communication',
      'creative',
      'analysis',
      'devops',
      'marketing',
    ],
  },
  {
    key: 'systemPrompt',
    label: 'System Prompt',
    type: 'textarea',
    required: true,
    placeholder: 'You are an expert at... When asked to... ',
  },
  {
    key: 'exampleTrigger',
    label: 'Example Trigger (optional)',
    type: 'text',
    required: false,
    placeholder: 'e.g. Write a weekly report for this week',
  },
]

function SkillsTab({ userSkills, onCreateSkill, onDeleteSkill }: SkillsTabProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<SkillCategory | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const categoryMap = getSkillsByCategory()
  const categories = Array.from(categoryMap.keys())

  const filteredBuiltin = DEFAULT_SKILLS.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (activeCategory === 'all' || s.category === activeCategory)
  })
  const filteredUser = userSkills.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (activeCategory === 'all' || s.category === activeCategory)
  })
  const groupedBuiltin = new Map<SkillCategory, Skill[]>()
  for (const s of filteredBuiltin) {
    const list = groupedBuiltin.get(s.category) ?? []
    list.push(s)
    groupedBuiltin.set(s.category, list)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-48 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto">
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Categories</p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === 'all' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              <span>⚡</span>
              <span>All skills</span>
              <span className="ml-auto text-xs text-gray-600">
                {DEFAULT_SKILLS.length + userSkills.length}
              </span>
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === cat ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
              >
                <span>{SKILL_CATEGORY_ICONS[cat]}</span>
                <span className="truncate">{SKILL_CATEGORY_LABELS[cat]}</span>
                <span className="ml-auto text-xs text-gray-600">
                  {categoryMap.get(cat)?.length ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Skills</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {DEFAULT_SKILLS.length} built-in · {userSkills.length} custom
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="search"
                placeholder="Search skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-56"
              />
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <span>+</span> New skill
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-8">
          {filteredUser.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                🔧 Your Skills{' '}
                <span className="text-gray-700 font-normal normal-case tracking-normal">
                  ({filteredUser.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredUser.map((s) => (
                  <SkillCard
                    key={s.id}
                    skill={s}
                    builtin={false}
                    onDelete={(id) => void onDeleteSkill(id)}
                  />
                ))}
              </div>
            </section>
          )}
          {Array.from(groupedBuiltin.entries()).map(([cat, skills]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{SKILL_CATEGORY_ICONS[cat]}</span>
                {SKILL_CATEGORY_LABELS[cat]}{' '}
                <span className="text-gray-700 font-normal normal-case tracking-normal">
                  ({skills.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {skills.map((s) => (
                  <SkillCard key={s.id} skill={s} builtin={true} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {showCreate && (
        <GenericModal
          title="Create Skill"
          subtitle="Define a reusable prompt template for your agents"
          fields={CREATE_SKILL_FIELDS}
          submitLabel="Create skill"
          onClose={() => setShowCreate(false)}
          onSave={async (values) => {
            await onCreateSkill({
              name: values.name ?? '',
              description: values.description ?? '',
              category: values.category ?? 'productivity',
              systemPrompt: values.systemPrompt ?? '',
              exampleTrigger: values.exampleTrigger ?? '',
            })
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}

// ── Custom plugin create modal ────────────────────────────────────────────────

const CUSTOM_PLUGIN_FIELDS: ModalField[] = [
  {
    key: 'name',
    label: 'Plugin Name',
    type: 'text',
    required: true,
    placeholder: 'e.g. My Internal API',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'text',
    required: false,
    placeholder: 'What does this plugin connect to?',
  },
  {
    key: 'docs_url',
    label: 'Documentation URL',
    type: 'url',
    required: false,
    placeholder: 'https://api.example.com/docs',
  },
  {
    key: 'usage_note',
    label: 'Usage Note (shown to agent)',
    type: 'textarea',
    required: false,
    placeholder:
      'Use this plugin to access the ACME API. API key is required in the X-Api-Key header...',
  },
]

// ── ConnectorsPage ────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const [tab, setTab] = useState<Tab>('models')
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [connectedCustom, setConnectedCustom] = useState<Set<string>>(new Set())
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null)
  const [customPlugins, setCustomPlugins] = useState<CustomPluginDef[]>([])
  const [showCreateCustomPlugin, setShowCreateCustomPlugin] = useState(false)
  const [installedMcps, setInstalledMcps] = useState<InstalledMcp[]>([])
  const [userSkills, setUserSkills] = useState<UserSkillDef[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    try {
      const [pluginsRes, mcpsRes, skillsRes, customPluginsRes] = await Promise.all([
        fetch('/api/plugins'),
        fetch('/api/mcps'),
        fetch('/api/skills'),
        fetch('/api/custom-plugins'),
      ])
      const pluginsData = (await pluginsRes.json()) as { connected: string[] }
      const mcpsData = (await mcpsRes.json()) as { mcps: InstalledMcp[] }
      const skillsData = (await skillsRes.json()) as { skills: UserSkillDef[] }
      const customPluginsData = (await customPluginsRes.json()) as { plugins: CustomPluginDef[] }
      setConnected(new Set(pluginsData.connected))
      setInstalledMcps(mcpsData.mcps)
      setUserSkills(skillsData.skills)
      setCustomPlugins(customPluginsData.plugins)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function handleSavePlugin(fields: Record<string, string>) {
    if (!activePlugin) return
    await fetch(`/api/plugins/${activePlugin.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    setConnected((prev) => new Set([...prev, activePlugin.id]))
    setActivePlugin(null)
  }

  async function handleDisconnectPlugin(plugin: Plugin) {
    await fetch(`/api/plugins/${plugin.id}`, { method: 'DELETE' })
    setConnected((prev) => {
      const n = new Set(prev)
      n.delete(plugin.id)
      return n
    })
  }

  async function handleInstallMcp(
    catalogId: string,
    name: string,
    pkg: string | undefined,
    url: string | undefined,
    transport: string,
    env: Record<string, string>,
    args: string[],
  ) {
    const res = await fetch('/api/mcps/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogId, name, package: pkg, url, transport, env, args }),
    })
    const data = (await res.json()) as { id: string }
    setInstalledMcps((prev) => [
      ...prev,
      {
        id: data.id,
        catalog_id: catalogId,
        name,
        package: pkg ?? null,
        url: url ?? null,
        transport,
        env,
        args,
        status: 'stopped',
      },
    ])
  }

  async function handleUninstallMcp(id: string) {
    await fetch(`/api/mcps/${id}`, { method: 'DELETE' })
    setInstalledMcps((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleCreateSkill(skill: {
    name: string
    description: string
    category: string
    systemPrompt: string
    exampleTrigger: string
  }) {
    const res = await fetch('/api/skills/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...skill }),
    })
    const data = (await res.json()) as { id: string }
    setUserSkills((prev) => [
      ...prev,
      {
        id: data.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        tags: [],
        system_prompt: skill.systemPrompt,
        steps: [],
        example_trigger: skill.exampleTrigger,
        docs_url: '',
        builtin: false,
      },
    ])
  }

  async function handleDeleteSkill(id: string) {
    await fetch(`/api/skills/${id}`, { method: 'DELETE' })
    setUserSkills((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleCreateCustomPlugin(values: Record<string, string>) {
    const res = await fetch('/api/custom-plugins/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        description: values.description,
        docsUrl: values.docs_url,
        usageNote: values.usage_note,
        fieldsSchema: [],
      }),
    })
    const data = (await res.json()) as { id: string }
    setCustomPlugins((prev) => [
      ...prev,
      {
        id: data.id,
        name: values.name ?? '',
        description: values.description ?? '',
        docs_url: values.docs_url ?? '',
        usage_note: values.usage_note ?? '',
        fieldsSchema: [],
      },
    ])
    setShowCreateCustomPlugin(false)
  }

  async function handleDeleteCustomPlugin(id: string) {
    await fetch(`/api/custom-plugins/${id}`, { method: 'DELETE' })
    setCustomPlugins((prev) => prev.filter((p) => p.id !== id))
    setConnectedCustom((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  async function handleConnectCustomPlugin(plugin: CustomPluginDef) {
    // custom plugins have no credential fields by default; just mark as connected
    await fetch(`/api/plugins/${plugin.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {} }),
    })
    setConnectedCustom((prev) => new Set([...prev, plugin.id]))
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Tab bar skeleton */}
        <div className="flex items-end gap-0 border-b border-gray-800 px-6 bg-gray-950 shrink-0 py-3">
          {['Models', 'Plugins', 'MCPs', 'Skills'].map((t) => (
            <div key={t} className="px-5 py-1">
              <div className="h-3 w-14 rounded bg-gray-800/60 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Card grid skeleton */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 p-4 space-y-3 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-800/60" />
                  <div className="space-y-1 flex-1">
                    <div className="h-4 w-1/2 rounded bg-gray-800/60" />
                    <div className="h-3 w-1/3 rounded bg-gray-700/40" />
                  </div>
                </div>
                <div className="h-3 w-full rounded bg-gray-800/60" />
                <div className="h-3 w-3/4 rounded bg-gray-700/40" />
                <div className="h-8 w-24 rounded-lg bg-gray-800/60 mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const modelConnectedCount = Array.from(connected).filter((id) =>
    MODEL_PLUGINS.some((p) => p.id === id),
  ).length
  const pluginConnectedCount = Array.from(connected).filter((id) =>
    OTHER_PLUGINS.some((p) => p.id === id),
  ).length

  const TABS: { id: Tab; label: string; badge: number | undefined }[] = [
    {
      id: 'models',
      label: 'AI Models',
      badge: modelConnectedCount > 0 ? modelConnectedCount : undefined,
    },
    {
      id: 'plugins',
      label: 'Plugins',
      badge: pluginConnectedCount > 0 ? pluginConnectedCount : undefined,
    },
    {
      id: 'mcps',
      label: 'MCPs',
      badge: installedMcps.length > 0 ? installedMcps.length : undefined,
    },
    { id: 'skills', label: 'Skills', badge: userSkills.length > 0 ? userSkills.length : undefined },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-end gap-0 border-b border-gray-800 px-6 bg-gray-950 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {tab === 'models' && (
          <ModelsTab
            connected={
              new Set(Array.from(connected).filter((id) => MODEL_PLUGINS.some((p) => p.id === id)))
            }
            onConnect={setActivePlugin}
            onDisconnect={(p) => void handleDisconnectPlugin(p)}
          />
        )}
        {tab === 'plugins' && (
          <PluginsTab
            connected={connected}
            onConnect={setActivePlugin}
            onDisconnect={(p) => void handleDisconnectPlugin(p)}
            customPlugins={customPlugins}
            onCreateCustomPlugin={() => setShowCreateCustomPlugin(true)}
            onDeleteCustomPlugin={(id) => void handleDeleteCustomPlugin(id)}
            onConnectCustom={(p) => void handleConnectCustomPlugin(p)}
            onDisconnectCustom={(id) => void handleDeleteCustomPlugin(id)}
            connectedCustom={connectedCustom}
          />
        )}
        {tab === 'mcps' && (
          <McpsTab
            installed={installedMcps}
            onInstall={handleInstallMcp}
            onUninstall={(id) => void handleUninstallMcp(id)}
          />
        )}
        {tab === 'skills' && (
          <SkillsTab
            userSkills={userSkills}
            onCreateSkill={handleCreateSkill}
            onDeleteSkill={handleDeleteSkill}
          />
        )}
      </div>

      {activePlugin && (
        <GenericModal
          title={activePlugin.name}
          subtitle={activePlugin.description}
          fields={activePlugin.fields.map((f) => ({ ...f, type: f.type as ModalField['type'] }))}
          submitLabel="Save"
          {...(activePlugin.setupUrl
            ? { footerLink: { label: 'Get API key / credentials', href: activePlugin.setupUrl } }
            : {})}
          onClose={() => setActivePlugin(null)}
          onSave={handleSavePlugin}
        />
      )}

      {showCreateCustomPlugin && (
        <GenericModal
          title="Create Custom Plugin"
          subtitle="Define a service not in the built-in catalog. Saves credentials and provides docs context to the agent."
          fields={CUSTOM_PLUGIN_FIELDS}
          submitLabel="Create plugin"
          onClose={() => setShowCreateCustomPlugin(false)}
          onSave={handleCreateCustomPlugin}
        />
      )}
    </div>
  )
}
