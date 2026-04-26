'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  Building2,
  FileText,
  MessageSquare,
  Bot,
  Globe,
  Plug,
  Database,
  Folder,
  Monitor,
  Code2,
  BarChart2,
  Mail,
  CalendarDays,
  DollarSign,
  Search,
  Rocket,
  HardDrive,
  Lock,
  Palette,
  PenLine,
  FlaskConical,
  Zap,
  Megaphone,
  Wrench,
  Layers,
  X,
  Loader2,
  CheckCircle2,
  Terminal,
  AlertCircle,
  MessageCircle,
} from 'lucide-react'
import { Select } from '@/app/components/ui/select'
import { Dialog } from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
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
import { PLUGIN_TO_PROVIDER, GOOGLE_PLUGIN_IDS } from '@open-greg/connectors/oauth-configs'

// ── Shared ────────────────────────────────────────────────────────────────────

type Tab = 'models' | 'plugins' | 'mcps' | 'skills'

const CATEGORY_ICONS: Record<PluginCategory, ReactNode> = {
  workspace: <Building2 size={14} />,
  project_management: <FileText size={14} />,
  communication: <MessageSquare size={14} />,
  crm: <Layers size={14} />,
  development: <Code2 size={14} />,
  storage: <HardDrive size={14} />,
  analytics: <BarChart2 size={14} />,
  email_marketing: <Mail size={14} />,
  calendar: <CalendarDays size={14} />,
  finance: <DollarSign size={14} />,
  seo: <Search size={14} />,
  hosting: <Rocket size={14} />,
  database: <Database size={14} />,
  ai: <Bot size={14} />,
}

const MCP_CATEGORY_ICONS: Record<McpCategory, ReactNode> = {
  filesystem: <Folder size={14} />,
  browser: <Globe size={14} />,
  database: <Database size={14} />,
  development: <Code2 size={14} />,
  communication: <MessageSquare size={14} />,
  productivity: <FileText size={14} />,
  search: <Search size={14} />,
  ai: <Bot size={14} />,
  media: <Palette size={14} />,
  devops: <Rocket size={14} />,
  data: <BarChart2 size={14} />,
  security: <Lock size={14} />,
}

const SKILL_CATEGORY_ICONS: Record<SkillCategory, ReactNode> = {
  writing: <PenLine size={14} />,
  coding: <Code2 size={14} />,
  research: <FlaskConical size={14} />,
  productivity: <Zap size={14} />,
  data: <BarChart2 size={14} />,
  communication: <MessageSquare size={14} />,
  creative: <Palette size={14} />,
  analysis: <Search size={14} />,
  devops: <Rocket size={14} />,
  marketing: <Megaphone size={14} />,
}

const STATUS_BADGE: Record<string, string> = {
  official: 'bg-primary/10 text-primary border border-blue-700',
  verified: 'bg-green-900/50 text-green-300 border border-green-700',
  beta: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  community: 'bg-purple-900/50 text-purple-300 border border-purple-700',
  planned: 'bg-muted text-muted-foreground border border-border',
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
    <Dialog
      open
      title={title}
      {...(subtitle !== undefined ? { description: subtitle } : {})}
      onClose={onClose}
      className="max-w-lg"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm text-foreground mb-1">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {field.type === 'select' && field.options ? (
              <Select
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              >
                <option value="">Select…</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            ) : field.type === 'textarea' ? (
              <textarea
                rows={5}
                placeholder={field.placeholder}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-primary resize-y"
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            ) : (
              <Input
                type={field.type === 'password' ? 'password' : 'text'}
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            )}
            {field.helpUrl && (
              <a
                href={field.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                How to get this →
              </a>
            )}
          </div>
        ))}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {footerLink && (
          <a
            href={footerLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
          >
            {footerLink.label} →
          </a>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ── CLI status types ───────────────────────────────────────────────────────────

interface CliStatus {
  installed: boolean
  authed: boolean
  detail: string
}

type AllCliStatus = Record<string, CliStatus>

// ── Google Workspace card ─────────────────────────────────────────────────────

const GOOGLE_FEATURE_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  google_calendar: 'Calendar',
  google_drive: 'Drive',
  google_docs: 'Docs',
  google_sheets: 'Sheets',
}

function GoogleWorkspaceCard({
  connected,
  cliStatus,
  onSetupInChat,
  onDisconnectGoogle,
}: {
  connected: Set<string>
  cliStatus: CliStatus | undefined
  onSetupInChat: (prompt: string) => void
  onDisconnectGoogle: (pluginId: string) => void
}) {
  const installed = cliStatus?.installed ?? false
  const authed = cliStatus?.authed ?? false
  const anyConnected = Array.from(GOOGLE_PLUGIN_IDS).some((id) => connected.has(id))

  const setupPrompt =
    'Help me set up the gog CLI (Google Workspace CLI) to connect Gmail, Calendar, Drive, Docs, and Sheets. Check if `gog` is installed (brew install steipete/tap/gogcli), then help me authenticate with my Google account.'

  return (
    <div
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all col-span-full sm:col-span-2 ${authed ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground text-sm">Google Workspace</span>
            {authed && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800 flex items-center gap-1">
                <CheckCircle2 size={10} /> Ready
              </span>
            )}
            {installed && !authed && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-800 flex items-center gap-1">
                <AlertCircle size={10} /> Not signed in
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Gmail, Calendar, Drive, Docs, and Sheets — via the{' '}
            <a
              href="https://github.com/steipete/gogcli"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              gog CLI
            </a>
            . The agent does the setup for you.
          </p>
        </div>
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1">
          <Terminal size={9} /> CLI
        </span>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 text-xs">
        <span
          className={`flex items-center gap-1 ${installed ? 'text-green-400' : 'text-muted-foreground'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${installed ? 'bg-green-400' : 'bg-gray-600'}`}
          />
          {installed ? 'gog installed' : 'gog not found'}
        </span>
        {installed && (
          <span
            className={`flex items-center gap-1 ${authed ? 'text-green-400' : 'text-yellow-400'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${authed ? 'bg-green-400' : 'bg-yellow-400'}`}
            />
            {authed ? 'Authenticated' : 'Not signed in'}
          </span>
        )}
      </div>

      {authed && anyConnected && (
        <div className="flex flex-wrap gap-2">
          {Array.from(GOOGLE_PLUGIN_IDS).map((id) => {
            const isOn = connected.has(id)
            return (
              <div
                key={id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${isOn ? 'border-green-700/60 bg-green-900/20 text-green-300' : 'border-border text-muted-foreground'}`}
              >
                {isOn && <CheckCircle2 size={10} />}
                {GOOGLE_FEATURE_LABELS[id] ?? id}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <a
          href="https://github.com/steipete/gogcli"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gray-600 transition-colors"
        >
          Docs ↗
        </a>
        {anyConnected ? (
          <button
            onClick={() => {
              for (const id of GOOGLE_PLUGIN_IDS) onDisconnectGoogle(id)
            }}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => onSetupInChat(setupPrompt)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors font-medium flex items-center justify-center gap-1.5"
          >
            <MessageCircle size={11} />
            Set up in chat
          </button>
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
  return (
    <div
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all ${connected ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-border hover:border-border'}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${connected ? 'bg-green-900/40 border border-green-800' : 'bg-muted border border-border'}`}
        >
          <div className="size-8 rounded-lg bg-gray-700 flex items-center justify-center text-xs font-bold text-foreground">
            {provider.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{provider.name}</span>
            {connected && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800 shrink-0">
                active
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground">{isLocal ? 'Local' : 'API key'}</span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={`text-xs ${provider.status === 'official' ? 'text-primary' : 'text-purple-400'}`}
            >
              {provider.status}
            </span>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{provider.description}</p>
      <div className="flex gap-2 mt-auto">
        {provider.docsUrl && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gray-600 transition-colors"
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
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors font-medium"
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
      <div className="sticky top-0 bg-sidebar-bg/90 backdrop-blur border-b border-border px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Models</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {connected.size} provider{connected.size !== 1 ? 's' : ''} configured
            </p>
          </div>
          {customPlugin && (
            <button
              onClick={() => onConnect(customPlugin)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border hover:border-gray-600 transition-colors"
            >
              <span className="text-lg leading-none">+</span>Custom server
            </button>
          )}
        </div>
      </div>
      <div className="px-6 py-5 space-y-8">
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
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
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
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
        <section className="border border-dashed border-border rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Need a provider not listed?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add any OpenAI-compatible server — LM Studio, vLLM, llama.cpp, Jan, or custom
              endpoint.
            </p>
          </div>
          {customPlugin && (
            <button
              onClick={() => onConnect(customPlugin)}
              className="shrink-0 px-4 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
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
  onConnectGoogle: () => void
  onDisconnectGoogle: (pluginId: string) => void
  onSetupInChat: (prompt: string) => void
  cliStatus: AllCliStatus
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
  cliStatus,
  onConnect,
  onDisconnect,
  onSetupInChat,
}: {
  plugin: Plugin
  connected: boolean
  cliStatus: CliStatus | undefined
  onConnect: (p: Plugin) => void
  onDisconnect: (p: Plugin) => void
  onSetupInChat: ((prompt: string) => void) | undefined
}) {
  const isPlanned = plugin.status === 'planned'
  const isCli = plugin.connectionType === 'cli'
  const isOAuth = plugin.connectionType === 'oauth' && !!PLUGIN_TO_PROVIDER[plugin.id]
  const connectLabel = isOAuth ? `Connect with ${plugin.name}` : 'Connect'
  const cliInstalled = cliStatus?.installed ?? false
  const cliAuthed = cliStatus?.authed ?? false

  return (
    <div
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all ${connected || cliAuthed ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-border hover:border-border'} ${isPlanned ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground text-sm truncate">{plugin.name}</span>
            {(connected || cliAuthed) && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800 flex items-center gap-1">
                <CheckCircle2 size={10} /> {isCli ? 'Ready' : 'Connected'}
              </span>
            )}
            {isCli && cliInstalled && !cliAuthed && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-yellow-900/40 text-yellow-300 border border-yellow-800 flex items-center gap-1">
                <AlertCircle size={10} /> Not signed in
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
            {plugin.description}
          </p>
        </div>
        {isCli ? (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1">
            <Terminal size={9} /> CLI
          </span>
        ) : (
          <span
            className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[plugin.status]}`}
          >
            {plugin.status}
          </span>
        )}
      </div>
      {isCli && (
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`flex items-center gap-1 ${cliInstalled ? 'text-green-400' : 'text-muted-foreground'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${cliInstalled ? 'bg-green-400' : 'bg-gray-600'}`}
            />
            {cliInstalled ? `${plugin.cliMeta?.bin} installed` : `${plugin.cliMeta?.bin} not found`}
          </span>
          {cliInstalled && (
            <span
              className={`flex items-center gap-1 ${cliAuthed ? 'text-green-400' : 'text-yellow-400'}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${cliAuthed ? 'bg-green-400' : 'bg-yellow-400'}`}
              />
              {cliAuthed ? 'Authenticated' : 'Not signed in'}
            </span>
          )}
        </div>
      )}
      {plugin.docsUrl && !isCli && (
        <a
          href={plugin.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Docs →
        </a>
      )}
      {!isPlanned && (
        <div className="flex gap-2">
          {isCli ? (
            <>
              {plugin.cliMeta?.toolUrl && (
                <a
                  href={plugin.cliMeta.toolUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gray-600 transition-colors"
                >
                  Tool ↗
                </a>
              )}
              <button
                onClick={() =>
                  onSetupInChat && plugin.cliMeta && onSetupInChat(plugin.cliMeta.setupPrompt)
                }
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors font-medium flex items-center justify-center gap-1.5"
              >
                <MessageCircle size={11} />
                Set up in chat
              </button>
            </>
          ) : connected ? (
            <button
              onClick={() => onDisconnect(plugin)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => onConnect(plugin)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors font-medium"
            >
              {connectLabel}
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
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all ${connected ? 'border-green-700/60' : 'border-border border-dashed hover:border-gray-600'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground text-sm truncate">{plugin.name}</span>
            {connected && (
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">
                ✓
              </span>
            )}
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              custom
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
            {plugin.description || 'No description'}
          </p>
        </div>
      </div>
      {plugin.docs_url && (
        <a
          href={plugin.docs_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Docs →
        </a>
      )}
      {plugin.usage_note && (
        <p className="text-xs text-muted-foreground/60 italic line-clamp-2">{plugin.usage_note}</p>
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
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors font-medium"
          >
            Connect
          </button>
        )}
        <button
          onClick={() => onDelete(plugin.id)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-800 transition-colors"
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
  onConnectGoogle: _onConnectGoogle,
  onDisconnectGoogle,
  onSetupInChat,
  cliStatus,
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
  // Exclude individual Google plugin cards — they're consolidated into GoogleWorkspaceCard
  const filtered = OTHER_PLUGINS.filter((p) => {
    if (GOOGLE_PLUGIN_IDS.has(p.id)) return false
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
      <aside className="w-48 shrink-0 border-r border-border bg-sidebar-bg overflow-y-auto">
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Categories
          </p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            >
              <Plug size={14} />
              <span>All plugins</span>
              <span className="ml-auto text-xs text-muted-foreground/60">
                {/* Non-Google individual plugins + 1 for consolidated Google Workspace card */}
                {OTHER_PLUGINS.filter((p) => !GOOGLE_PLUGIN_IDS.has(p.id)).length + 1}
              </span>
            </button>
          </li>
          {categories.map((cat) => {
            // Count non-Google plugins in this category for sidebar badge
            const catPlugins = (categoryMap.get(cat) ?? []).filter(
              (p) => !GOOGLE_PLUGIN_IDS.has(p.id),
            )
            const sidebarLabel = cat === 'workspace' ? 'Workspace' : CATEGORY_LABELS[cat]
            return (
              <li key={cat}>
                <button
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === cat ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                >
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span className="truncate">{sidebarLabel}</span>
                  <span className="ml-auto text-xs text-muted-foreground/60">
                    {catPlugins.length}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-sidebar-bg/90 backdrop-blur border-b border-border px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Plugins</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
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
                className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-primary w-56"
              />
              <button
                onClick={onCreateCustomPlugin}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border hover:border-gray-600 transition-colors"
              >
                <span>+</span> Custom
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-8">
          {/* Google Workspace — consolidated card, always shown unless search hides it */}
          {(!search || 'google gmail calendar drive docs sheets'.includes(search.toLowerCase())) &&
            (activeCategory === 'all' ||
              activeCategory === 'workspace' ||
              activeCategory === 'calendar') && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building2 size={14} /> Google Workspace
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <GoogleWorkspaceCard
                    connected={connected}
                    cliStatus={cliStatus['gog']}
                    onSetupInChat={onSetupInChat}
                    onDisconnectGoogle={onDisconnectGoogle}
                  />
                </div>
              </section>
            )}
          {customPlugins.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wrench size={14} /> Custom Plugins{' '}
                <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">
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
            <p className="text-muted-foreground text-sm">No other plugins match your search.</p>
          )}
          {Array.from(grouped.entries()).map(([cat, plugins]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{CATEGORY_ICONS[cat]}</span>
                {/* "workspace" label is "Google Workspace" in CATEGORY_LABELS but Google is shown separately above */}
                {cat === 'workspace' ? 'Workspace' : CATEGORY_LABELS[cat]}{' '}
                <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">
                  ({plugins.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {plugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    connected={connected.has(plugin.id)}
                    cliStatus={plugin.cliMeta ? cliStatus[plugin.cliMeta.bin] : undefined}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onSetupInChat={onSetupInChat}
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
      className={`bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all ${installed ? 'border-green-700/60 shadow-sm shadow-green-900/20' : 'border-border hover:border-border'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-foreground text-sm">{server.name}</span>
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
          <p className="text-muted-foreground text-xs leading-relaxed">{server.description}</p>
        </div>
      </div>
      {server.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {server.tools.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
            >
              {t}
            </span>
          ))}
          {server.tools.length > 4 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
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
            className="px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gray-600 transition-colors"
          >
            Docs
          </a>
        )}
        {server.githubUrl && (
          <a
            href={server.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-gray-600 transition-colors"
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
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors font-medium"
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
      <aside className="w-48 shrink-0 border-r border-border bg-sidebar-bg overflow-y-auto">
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Categories
          </p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            >
              <Monitor size={14} />
              <span>All servers</span>
              <span className="ml-auto text-xs text-muted-foreground/60">{MCP_SERVERS.length}</span>
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === cat ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
              >
                <span>{MCP_CATEGORY_ICONS[cat]}</span>
                <span className="truncate">{MCP_CATEGORY_LABELS[cat]}</span>
                <span className="ml-auto text-xs text-muted-foreground/60">
                  {categoryMap.get(cat)?.length ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-sidebar-bg/90 backdrop-blur border-b border-border px-6 py-4 z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">MCP Servers</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {installed.length} installed · give agents new tools
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="search"
                placeholder="Search MCPs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Button variant="outline" size="sm" onClick={() => setShowCustom(true)}>
                + Custom
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-8">
          {Array.from(grouped.entries()).map(([cat, servers]) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{MCP_CATEGORY_ICONS[cat]}</span>
                {MCP_CATEGORY_LABELS[cat]}{' '}
                <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">
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
          <section className="border border-dashed border-border rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Don't see the MCP you need?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add any MCP server by npm package name or remote SSE/HTTP URL. Browse{' '}
                <a
                  href="https://www.pulsemcp.com/servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  PulseMCP
                </a>{' '}
                or{' '}
                <a
                  href="https://github.com/wong2/awesome-mcp-servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Awesome MCP Servers
                </a>
                .
              </p>
            </div>
            <button
              onClick={() => setShowCustom(true)}
              className="shrink-0 px-4 py-2 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
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

interface CredentialStatus {
  key: string
  set: boolean
}

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
  enabled?: boolean
  requiresEnv?: string[]
  credentialStatus?: CredentialStatus[]
  version?: string
  body?: string
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
  onRefresh: () => void
}

// Unified type for list items (built-in or user)
type SkillListItem = { kind: 'builtin'; skill: Skill } | { kind: 'user'; skill: UserSkillDef }

function SkillDetailPanel({
  item,
  onClose,
  onDelete,
  onToggle,
  onRefresh,
}: {
  item: SkillListItem
  onClose: () => void
  onDelete?: (id: string) => void
  onToggle?: (id: string, enabled: boolean) => void
  onRefresh: () => void
}) {
  const [connectingKey, setConnectingKey] = useState<string | null>(null)
  const [credValue, setCredValue] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isUser = item.kind === 'user'
  const skill = item.skill
  const name = skill.name
  const description = skill.description
  const category = skill.category as SkillCategory

  const requiresEnv = isUser ? (item.skill.requiresEnv ?? []) : []
  const credStatus = isUser ? (item.skill.credentialStatus ?? []) : []
  const enabled = isUser ? (item.skill.enabled ?? true) : true
  const prompt = item.kind === 'builtin' ? item.skill.systemPrompt : item.skill.system_prompt
  const docsUrl = item.kind === 'builtin' ? (item.skill.docsUrl ?? '') : (item.skill.docs_url ?? '')
  const exampleTrigger =
    item.kind === 'builtin' ? (item.skill.exampleTrigger ?? '') : (item.skill.example_trigger ?? '')

  async function saveCredential(skillName: string, envKey: string) {
    if (!credValue) return
    setCredSaving(true)
    setCredError(null)
    try {
      const res = await fetch(`/api/skills/${skillName}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envKey, value: credValue }),
      })
      if (res.ok) {
        setConnectingKey(null)
        setCredValue('')
        onRefresh()
      } else {
        const err = (await res.json()) as { error?: string }
        setCredError(err.error ?? 'Failed to save')
      }
    } catch (e) {
      setCredError(String(e))
    } finally {
      setCredSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0">
            {SKILL_CATEGORY_ICONS[category] ?? <Zap size={16} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground truncate">{name}</h2>
              {!isUser && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-blue-900/40 text-primary border border-blue-800">
                  built-in
                </span>
              )}
              {isUser && (
                <span
                  className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full border ${enabled ? 'bg-green-900/40 text-green-300 border-green-800' : 'bg-muted text-muted-foreground border-border'}`}
                >
                  {enabled ? 'enabled' : 'disabled'}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground leading-none"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-5 p-5">
        {/* Action buttons for user skills */}
        {isUser && (
          <div className="flex gap-2">
            <button
              onClick={() => onToggle && onToggle(item.skill.name, !enabled)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${enabled ? 'border-green-800 bg-green-900/30 text-green-300 hover:bg-green-900/50' : 'border-border bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {enabled ? 'Disable' : 'Enable'}
            </button>
            {onDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-800 transition-colors"
              >
                Delete
              </button>
            )}
            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Docs ↗
              </a>
            )}
          </div>
        )}

        {/* Credentials section (user skills only) */}
        {isUser && requiresEnv.length > 0 && (
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Credentials
            </h3>
            <div className="flex flex-col gap-2">
              {credStatus.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${c.set ? 'bg-green-500' : 'bg-amber-500'}`}
                    />
                    <code className="text-sm text-foreground">{c.key}</code>
                    <span className="text-xs text-muted-foreground/60">
                      {c.set ? 'Connected' : 'Not set'}
                    </span>
                  </div>
                  {!c.set && (
                    <button
                      onClick={() => {
                        setConnectingKey(c.key)
                        setCredValue('')
                        setCredError(null)
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg border border-blue-800 bg-blue-900/30 text-primary hover:bg-primary/10 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
            {connectingKey && (
              <div className="mt-3 rounded-lg border border-dashed border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Value for <code className="font-mono text-foreground">{connectingKey}</code>
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    className="flex-1 font-mono"
                    placeholder="Paste your key here…"
                    value={credValue}
                    onChange={(e) => setCredValue(e.target.value)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => void saveCredential(name, connectingKey)}
                    disabled={credSaving || !credValue}
                  >
                    {credSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setConnectingKey(null)
                      setCredValue('')
                      setCredError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {credError && <p className="mt-1.5 text-xs text-red-400">{credError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Example trigger */}
        {exampleTrigger && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Example
            </p>
            <p className="text-sm text-muted-foreground italic">&ldquo;{exampleTrigger}&rdquo;</p>
          </div>
        )}

        {/* Prompt body */}
        {prompt && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {isUser ? 'Instructions / Prompt' : 'System Prompt'}
            </p>
            <pre className="whitespace-pre-wrap rounded-xl bg-card border border-border p-4 font-mono text-xs text-muted-foreground leading-relaxed overflow-auto max-h-80">
              {prompt}
            </pre>
          </div>
        )}

        {/* Docs link for built-in */}
        {!isUser && docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:text-primary underline"
          >
            Documentation ↗
          </a>
        )}
      </div>

      {confirmDelete && onDelete && (
        <Dialog
          open
          title="Delete skill"
          description={`Delete "${name}"? This cannot be undone.`}
          onClose={() => setConfirmDelete(false)}
          className="max-w-sm"
        >
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                onDelete(item.skill.id)
                onClose()
              }}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      )}
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

function SkillsTab({ userSkills, onCreateSkill, onDeleteSkill, onRefresh }: SkillsTabProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<SkillCategory | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<SkillListItem | null>(null)

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

  async function handleToggle(skillName: string, enabled: boolean) {
    await fetch(`/api/skills/${skillName}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    onRefresh()
    // Optimistically update selected
    if (selected?.kind === 'user' && selected.skill.name === skillName) {
      setSelected({ kind: 'user', skill: { ...selected.skill, enabled } })
    }
  }

  // ── List row component ─────────────────────────────────────────────────────
  function SkillRow({ item }: { item: SkillListItem }) {
    const s = item.skill
    const category = s.category as SkillCategory
    const isSelected = selected?.kind === item.kind && selected.skill.name === s.name
    const enabled = item.kind === 'user' ? (item.skill.enabled ?? true) : true
    const hasMissingCreds =
      item.kind === 'user' && (item.skill.credentialStatus ?? []).some((c) => !c.set)

    return (
      <button
        onClick={() => setSelected(item)}
        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
      >
        <span className="flex items-center shrink-0 text-muted-foreground">
          {SKILL_CATEGORY_ICONS[category] ?? <Zap size={14} />}
        </span>
        <span className="flex-1 text-sm truncate">{s.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasMissingCreds && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Missing credentials" />
          )}
          {item.kind === 'user' && !enabled && (
            <span className="text-xs text-muted-foreground/60">off</span>
          )}
          {item.kind === 'builtin' && (
            <span className="text-xs text-muted-foreground/40">built-in</span>
          )}
        </div>
      </button>
    )
  }

  const allItems: SkillListItem[] = [
    ...filteredUser.map((s): SkillListItem => ({ kind: 'user', skill: s })),
    ...filteredBuiltin.map((s): SkillListItem => ({ kind: 'builtin', skill: s })),
  ]

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: category sidebar */}
      <aside className="w-44 shrink-0 border-r border-border bg-sidebar-bg overflow-y-auto">
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Categories
          </p>
        </div>
        <ul className="py-2">
          <li>
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
            >
              <Zap size={14} />
              <span>All skills</span>
              <span className="ml-auto text-xs text-muted-foreground/60">
                {DEFAULT_SKILLS.length + userSkills.length}
              </span>
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${activeCategory === cat ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
              >
                <span>{SKILL_CATEGORY_ICONS[cat]}</span>
                <span className="truncate">{SKILL_CATEGORY_LABELS[cat]}</span>
                <span className="ml-auto text-xs text-muted-foreground/60">
                  {categoryMap.get(cat)?.length ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Middle: skill list */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-sidebar-bg/90 backdrop-blur border-b border-border px-3 py-3 z-10">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-sm font-bold text-foreground flex-1">Skills</h1>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 text-foreground transition-colors"
            >
              New skill
            </button>
          </div>
          <Input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredUser.length > 0 && (
            <div className="mb-3">
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                Your skills ({filteredUser.length})
              </p>
              {filteredUser.map((s) => (
                <SkillRow key={s.id} item={{ kind: 'user', skill: s }} />
              ))}
            </div>
          )}
          {filteredBuiltin.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                Built-in ({filteredBuiltin.length})
              </p>
              {filteredBuiltin.map((s) => (
                <SkillRow key={s.id} item={{ kind: 'builtin', skill: s }} />
              ))}
            </div>
          )}
          {allItems.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground/60">
              No skills match your search.
            </p>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 overflow-hidden bg-sidebar-bg">
        {selected ? (
          <SkillDetailPanel
            item={selected}
            onClose={() => setSelected(null)}
            {...(selected.kind === 'user'
              ? {
                  onDelete: (id: string) => {
                    void onDeleteSkill(id)
                    setSelected(null)
                  },
                }
              : {})}
            onToggle={(skillName, enabled) => void handleToggle(skillName, enabled)}
            onRefresh={onRefresh}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground/60">
            Select a skill to view details
          </div>
        )}
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
  const [cliStatus, setCliStatus] = useState<AllCliStatus>({})
  const oauthListenerRef = useRef<((e: MessageEvent) => void) | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [pluginsRes, mcpsRes, skillsRes, customPluginsRes, cliRes] = await Promise.all([
        fetch('/api/plugins'),
        fetch('/api/mcps'),
        fetch('/api/skills'),
        fetch('/api/custom-plugins'),
        fetch('/api/connectors/cli-status'),
      ])
      const pluginsData = (await pluginsRes.json()) as { connected: string[] }
      const mcpsData = (await mcpsRes.json()) as { mcps: InstalledMcp[] }
      const skillsData = (await skillsRes.json()) as { skills: UserSkillDef[] }
      const customPluginsData = (await customPluginsRes.json()) as { plugins: CustomPluginDef[] }
      const cliData = (await cliRes.json()) as AllCliStatus
      setConnected(new Set(pluginsData.connected ?? []))
      setInstalledMcps(mcpsData.mcps ?? [])
      setUserSkills(skillsData.skills ?? [])
      setCustomPlugins(customPluginsData.plugins ?? [])
      setCliStatus(cliData)
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

  async function handleDisconnectPluginById(pluginId: string) {
    await fetch(`/api/plugins/${pluginId}`, { method: 'DELETE' })
    setConnected((prev) => {
      const n = new Set(prev)
      n.delete(pluginId)
      return n
    })
  }

  /** Called when user clicks "Connect with X" for an OAuth plugin */
  async function handleConnectOAuth(plugin: Plugin) {
    const providerKey = PLUGIN_TO_PROVIDER[plugin.id]
    if (!providerKey) {
      setActivePlugin(plugin)
      return
    }

    const res = await fetch(`/api/oauth/start/${plugin.id}`)
    const data = (await res.json()) as {
      authUrl?: string
      needsSetup?: boolean
      provider?: string
      error?: string
    }

    if (data.needsSetup || !data.authUrl) {
      // Redirect admin to Settings → OAuth Apps to configure once
      window.location.href = `/settings?tab=oauth&setup=${encodeURIComponent(data.provider ?? providerKey)}`
      return
    }

    openOAuthPopup(plugin.id, data.authUrl)
  }

  function openOAuthPopup(pluginId: string, authUrl: string) {
    const popup = window.open(authUrl, 'oauth_popup', 'width=600,height=700,left=100,top=100')
    // Remove previous listener
    if (oauthListenerRef.current) {
      window.removeEventListener('message', oauthListenerRef.current)
    }
    const listener = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'oauth_success') {
        popup?.close()
        window.removeEventListener('message', listener)
        oauthListenerRef.current = null
        // Mark all connected google plugins if this is a google plugin
        if (GOOGLE_PLUGIN_IDS.has(pluginId)) {
          setConnected((prev) => new Set([...prev, ...GOOGLE_PLUGIN_IDS]))
        } else {
          setConnected((prev) => new Set([...prev, pluginId]))
        }
      } else if (e.data?.type === 'oauth_error') {
        popup?.close()
        window.removeEventListener('message', listener)
        oauthListenerRef.current = null
      }
    }
    oauthListenerRef.current = listener
    window.addEventListener('message', listener)
  }

  /** Navigate to chat with pre-filled setup message for CLI plugins */
  function handleSetupInChat(prompt: string) {
    window.location.href = `/chat?message=${encodeURIComponent(prompt)}`
  }

  /** Route plugin connect: CLI vs OAuth vs modal */
  function handleConnectPlugin(plugin: Plugin) {
    if (plugin.connectionType === 'cli') {
      if (plugin.cliMeta) handleSetupInChat(plugin.cliMeta.setupPrompt)
      return
    }
    const isOAuth = plugin.connectionType === 'oauth' && !!PLUGIN_TO_PROVIDER[plugin.id]
    if (isOAuth) {
      void handleConnectOAuth(plugin)
    } else {
      setActivePlugin(plugin)
    }
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
        <div className="flex items-end gap-0 border-b border-border px-6 bg-sidebar-bg shrink-0 py-3">
          {['Models', 'Plugins', 'MCPs', 'Skills'].map((t) => (
            <div key={t} className="px-5 py-1">
              <div className="h-3 w-14 rounded bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Card grid skeleton */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/50" />
                  <div className="space-y-1 flex-1">
                    <div className="h-4 w-1/2 rounded bg-muted/50" />
                    <div className="h-3 w-1/3 rounded bg-gray-700/40" />
                  </div>
                </div>
                <div className="h-3 w-full rounded bg-muted/50" />
                <div className="h-3 w-3/4 rounded bg-gray-700/40" />
                <div className="h-8 w-24 rounded-lg bg-muted/50 mt-2" />
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
      <div className="flex items-end gap-0 border-b border-border px-6 bg-sidebar-bg shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
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
            onConnect={handleConnectPlugin}
            onDisconnect={(p) => void handleDisconnectPlugin(p)}
            onConnectGoogle={() =>
              handleSetupInChat('Help me set up the gog CLI for Google Workspace access.')
            }
            onDisconnectGoogle={(id) => void handleDisconnectPluginById(id)}
            onSetupInChat={handleSetupInChat}
            cliStatus={cliStatus}
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
            onRefresh={() => void loadAll()}
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
