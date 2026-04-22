'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Terminal, Globe, FolderOpen, Monitor } from 'lucide-react'
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Separator,
  StatusDot,
  cn,
} from '../components/ui/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Model {
  id: string
  name: string
  provider: string
  available: boolean
}

interface Settings {
  llm?: {
    primary?: string
    models?: string[]
  }
  permissions?: {
    toolsEnabled?: {
      shell?: boolean
      browser?: boolean
      filesystem?: boolean
      gui?: boolean
    }
  }
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded bg-gray-800 animate-pulse" />
          <div className="h-3 w-48 rounded bg-gray-800 animate-pulse" />
        </div>
        <div className="h-5 w-16 rounded bg-gray-800 animate-pulse" />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// LLM Providers section
// ---------------------------------------------------------------------------

function LlmProviders() {
  const [models, setModels] = useState<Model[]>([])
  const [primary, setPrimary] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/models')
        .then((r) => r.json())
        .catch(() => ({ models: [] })),
      fetch('/api/settings')
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([modelsData, settingsData]: [{ models: Model[] }, Settings]) => {
      setModels(modelsData.models ?? [])
      setPrimary(settingsData.llm?.primary)
      setLoading(false)
    })
  }, [])

  return (
    <section data-testid="registry-category-llm" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">LLM Providers</h2>
        <Link
          href="/settings"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Configure models in Settings
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : models.length === 0 ? (
        <EmptyState
          title="No models configured"
          description="Add a model in Settings to get started."
        />
      ) : (
        <div className="space-y-2">
          {models.map((model) => (
            <Card key={model.id} data-testid={`registry-item-${model.id}`}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusDot status={model.available ? 'online' : 'offline'} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{model.name}</span>
                      <Badge variant="muted">{model.provider}</Badge>
                      {primary === model.id && <Badge variant="info">primary</Badge>}
                    </div>
                    <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{model.id}</p>
                  </div>
                </div>
                <Badge variant={model.available ? 'success' : 'default'}>
                  {model.available ? 'available' : 'offline'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// MCP Servers section
// ---------------------------------------------------------------------------

const PLANNED_MCP_SERVERS = [
  { id: 'github-mcp', name: 'GitHub MCP', description: 'Repository and PR management' },
  { id: 'gmail-mcp', name: 'Gmail MCP', description: 'Email read and send' },
]

function McpServers() {
  return (
    <section data-testid="registry-category-mcp" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">MCP Servers</h2>
        <Link
          href="/connectors"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Add in Connectors
        </Link>
      </div>

      <Card>
        <CardContent className="py-0 divide-y divide-gray-800">
          <div className="py-6">
            <EmptyState
              title="No MCP servers configured"
              description="Connect MCP servers to extend agent capabilities."
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {PLANNED_MCP_SERVERS.map((server) => (
          <Card key={server.id} data-testid={`registry-item-${server.id}`} className="opacity-60">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <StatusDot status="offline" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{server.name}</span>
                    <Badge variant="muted">planned</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{server.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tools section
// ---------------------------------------------------------------------------

interface ToolDef {
  id: 'shell' | 'browser' | 'filesystem' | 'gui'
  name: string
  description: string
  icon: React.ReactNode
}

const TOOL_DEFS: ToolDef[] = [
  {
    id: 'shell',
    name: 'Shell',
    description: 'Execute shell commands and scripts',
    icon: <Terminal size={16} />,
  },
  {
    id: 'browser',
    name: 'Browser',
    description: 'Browse and interact with web pages',
    icon: <Globe size={16} />,
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read and write files on disk',
    icon: <FolderOpen size={16} />,
  },
  {
    id: 'gui',
    name: 'GUI',
    description: 'Control desktop GUI applications',
    icon: <Monitor size={16} />,
  },
]

function ToolsSection({ settings }: { settings: Settings | null }) {
  const enabled = settings?.permissions?.toolsEnabled ?? {}

  return (
    <section data-testid="registry-category-tools" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Tools</h2>
        <Link
          href="/settings"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Configure in Settings
        </Link>
      </div>

      <Card>
        <CardContent className="divide-y divide-gray-800 py-0">
          {TOOL_DEFS.map((tool) => {
            const isEnabled = enabled[tool.id] ?? false
            return (
              <div
                key={tool.id}
                data-testid={`registry-item-${tool.id}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn('flex-shrink-0', isEnabled ? 'text-blue-400' : 'text-gray-600')}
                  >
                    {tool.icon}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-white">{tool.name}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                  </div>
                </div>
                <Badge variant={isEnabled ? 'success' : 'default'}>
                  {isEnabled ? 'enabled' : 'disabled'}
                </Badge>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegistryPage() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: Settings) => setSettings(data))
      .catch(() => setSettings({}))
  }, [])

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Registry</h1>
        <p className="text-sm text-gray-500 mt-1">All configured providers and tools</p>
      </div>

      <LlmProviders />

      <Separator />

      <McpServers />

      <Separator />

      <ToolsSection settings={settings} />
    </main>
  )
}
