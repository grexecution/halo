'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Wifi,
  WifiOff,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Terminal,
  AlertTriangle,
  ChevronRight,
  Smartphone,
  Activity,
  Plus,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Label,
  Select,
  Switch,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
} from '../components/ui/index'

// ---- Types ----

interface LLMModel {
  id: string
  provider: 'ollama' | 'anthropic' | 'openai' | 'z.ai' | 'custom'
  name: string
  modelId: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
  limitTokensPerDay?: number
  limitCostPerDay?: number
}

interface Settings {
  llm: { primary: string; models: LLMModel[] }
  vision: { provider: 'local' | 'cloud'; model: string }
  stt: { provider: 'local' | 'cloud'; model: string }
  tts: { provider: 'local' | 'cloud'; model: string; voice?: string }
  permissions: {
    sudoEnabled: boolean
    urlWhitelistMode: boolean
    allowedUrls: string[]
    blockedUrls: string[]
    toolsEnabled: Record<string, boolean>
  }
  telemetry: { enabled: boolean; otelEndpoint: string }
  memory: {
    observationModelId: string
    fallbackModelId?: string
  }
}

const DEFAULT_SETTINGS: Settings = {
  llm: { primary: '', models: [] },
  vision: { provider: 'local', model: 'paddleocr' },
  stt: { provider: 'local', model: 'parakeet' },
  tts: { provider: 'local', model: 'piper', voice: '' },
  permissions: {
    sudoEnabled: false,
    urlWhitelistMode: false,
    allowedUrls: [],
    blockedUrls: [],
    toolsEnabled: {
      shell: true,
      browser: true,
      filesystem: true,
      gui: false,
    },
  },
  telemetry: { enabled: false, otelEndpoint: '' },
  memory: { observationModelId: 'auto' },
}

// ---- Helpers ----

function SaveButton({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Button data-testid="save-settings-button" variant="default" size="sm" onClick={onSave}>
        Save
      </Button>
      {saved && (
        <span data-testid="save-confirmation" className="text-xs text-green-400 transition-opacity">
          Saved
        </span>
      )}
    </div>
  )
}

// ---- Tab: Models (redirect to Connectors) ----

function ModelsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white">Language Models</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Models are now managed in the Connectors page.
        </p>
      </div>
      <Card>
        <CardContent className="py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-800 flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <p className="text-white font-medium">AI Models live in Connectors</p>
              <p className="text-sm text-gray-500 mt-1">
                Connect providers, set the primary model, enable/disable, and configure usage limits
                all in one place.
              </p>
            </div>
            <a
              href="/connectors"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Open Connectors →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── MessagingTab ──────────────────────────────────────────────────────────────

interface BotStatus {
  channel: 'telegram' | 'discord'
  running: boolean
  startedAt?: string
  error?: string
}

const CHANNEL_META: Record<string, { label: string; icon: string; pluginId: string }> = {
  telegram: { label: 'Telegram', icon: '✈️', pluginId: 'telegram' },
  discord: { label: 'Discord', icon: '🎮', pluginId: 'discord' },
}

function MessagingTab() {
  const [bots, setBots] = useState<BotStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:3001/api/messaging/status')
      .then((r) => r.json())
      .then((d: { bots?: BotStatus[] }) => setBots(d.bots ?? []))
      .catch(() => setBots([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white">Messaging Bots</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Talk to your agents via Telegram (and Discord later). Connect a bot in Connectors, then
          check its live status here.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Checking bot status…</p>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => {
            const meta = CHANNEL_META[bot.channel]
            return (
              <Card key={bot.channel}>
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta?.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{meta?.label ?? bot.channel}</p>
                      {bot.running ? (
                        <p className="text-xs text-green-400 mt-0.5">
                          Running · started{' '}
                          {bot.startedAt ? new Date(bot.startedAt).toLocaleTimeString() : 'unknown'}
                        </p>
                      ) : bot.error ? (
                        <p className="text-xs text-red-400 mt-0.5">Error: {bot.error}</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bot.running && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/40 border border-green-800 text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Live
                      </span>
                    )}
                    <a
                      href={`/connectors?tab=plugins&plugin=${meta?.pluginId ?? bot.channel}`}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
                    >
                      Configure →
                    </a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-5 px-5">
          <p className="text-xs text-gray-400">
            To connect Telegram: go to{' '}
            <a href="/connectors?tab=plugins" className="text-blue-400 underline">
              Connectors → Plugins
            </a>
            , find <strong className="text-white">Telegram</strong>, and enter your BotFather token.
            The bot starts automatically after saving.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Tab: Vision & Voice ----

function VisionVoiceTab({
  settings,
  setSettings,
  onSave,
  saved,
}: {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => void
  saved: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Vision and Voice</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure OCR and audio processing.</p>
        </div>
        <SaveButton onSave={onSave} saved={saved} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vision card */}
        <Card>
          <CardHeader>
            <CardTitle>Vision / OCR</CardTitle>
            <CardDescription>
              Used to extract text from images, screenshots, and documents. Local models run
              on-device; cloud models send data to an external API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vision-provider">Provider</Label>
              <Select
                id="vision-provider"
                value={settings.vision.provider}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    vision: { ...prev.vision, provider: e.target.value as 'local' | 'cloud' },
                  }))
                }
              >
                <option value="local">Local</option>
                <option value="cloud">Cloud</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="vision-model">Model</Label>
              <Input
                id="vision-model"
                placeholder={settings.vision.provider === 'local' ? 'paddleocr' : 'gpt-4o'}
                value={settings.vision.model}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    vision: { ...prev.vision, model: e.target.value },
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Voice card */}
        <Card>
          <CardHeader>
            <CardTitle>Voice</CardTitle>
            <CardDescription>Speech-to-text and text-to-speech configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* STT */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Speech to Text (STT)
              </p>
              <div>
                <Label htmlFor="stt-provider">Provider</Label>
                <Select
                  id="stt-provider"
                  value={settings.stt.provider}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      stt: { ...prev.stt, provider: e.target.value as 'local' | 'cloud' },
                    }))
                  }
                >
                  <option value="local">Local</option>
                  <option value="cloud">Cloud</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="stt-model">Model</Label>
                <Input
                  id="stt-model"
                  placeholder={settings.stt.provider === 'local' ? 'parakeet' : 'whisper-1'}
                  value={settings.stt.model}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      stt: { ...prev.stt, model: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <Separator />

            {/* TTS */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Text to Speech (TTS)
              </p>
              <div>
                <Label htmlFor="tts-provider">Provider</Label>
                <Select
                  id="tts-provider"
                  value={settings.tts.provider}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      tts: { ...prev.tts, provider: e.target.value as 'local' | 'cloud' },
                    }))
                  }
                >
                  <option value="local">Local</option>
                  <option value="cloud">Cloud</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="tts-model">Model</Label>
                <Input
                  id="tts-model"
                  placeholder={settings.tts.provider === 'local' ? 'piper' : 'tts-1'}
                  value={settings.tts.model}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      tts: { ...prev.tts, model: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="tts-voice">Voice (optional)</Label>
                <Input
                  id="tts-voice"
                  placeholder="e.g. en_US-lessac-medium"
                  value={settings.tts.voice ?? ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      tts: { ...prev.tts, voice: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- Tab: Permissions ----

interface UrlListProps {
  label: string
  urls: string[]
  onAdd: (url: string) => void
  onRemove: (url: string) => void
}

function UrlList({ label, urls, onAdd, onRemove }: UrlListProps) {
  const [draft, setDraft] = useState('')

  function handleAdd() {
    const trimmed = draft.trim()
    if (!trimmed || urls.includes(trimmed)) return
    onAdd(trimmed)
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          className="text-xs"
        />
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus size={12} />
        </Button>
      </div>
      {urls.length > 0 && (
        <div className="space-y-1">
          {urls.map((url) => (
            <div
              key={url}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg border border-gray-700/50"
            >
              <span className="flex-1 text-xs text-gray-300 font-mono truncate">{url}</span>
              <button
                onClick={() => onRemove(url)}
                className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                aria-label={`Remove ${url}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TOOL_DEFS: { key: string; label: string; description: string }[] = [
  { key: 'shell', label: 'Shell', description: 'Allow the agent to run shell commands.' },
  {
    key: 'browser',
    label: 'Browser',
    description: 'Allow the agent to open and control a web browser.',
  },
  {
    key: 'filesystem',
    label: 'Filesystem',
    description: 'Allow the agent to read and write files on disk.',
  },
  {
    key: 'gui',
    label: 'GUI',
    description: 'Allow the agent to interact with desktop applications.',
  },
]

function PermissionsTab({
  settings,
  setSettings,
  onSave,
  saved,
}: {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => void
  saved: boolean
}) {
  function toggleTool(key: string, value: boolean) {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        toolsEnabled: { ...prev.permissions.toolsEnabled, [key]: value },
      },
    }))
  }

  function addAllowedUrl(url: string) {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        allowedUrls: [...prev.permissions.allowedUrls, url],
      },
    }))
  }

  function removeAllowedUrl(url: string) {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        allowedUrls: prev.permissions.allowedUrls.filter((u) => u !== url),
      },
    }))
  }

  function addBlockedUrl(url: string) {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        blockedUrls: [...prev.permissions.blockedUrls, url],
      },
    }))
  }

  function removeBlockedUrl(url: string) {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        blockedUrls: prev.permissions.blockedUrls.filter((u) => u !== url),
      },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Permissions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Control what the agent is allowed to do.</p>
        </div>
        <SaveButton onSave={onSave} saved={saved} />
      </div>

      {/* Tool toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Tool Access</CardTitle>
          <CardDescription>Enable or disable individual agent tools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOOL_DEFS.map((tool) => (
            <div key={tool.key} className="flex items-start gap-3">
              <Switch
                id={`tool-${tool.key}`}
                checked={settings.permissions.toolsEnabled[tool.key] ?? false}
                onChange={(v) => toggleTool(tool.key, v)}
              />
              <div>
                <label
                  htmlFor={`tool-${tool.key}`}
                  className="text-sm text-white font-medium cursor-pointer"
                >
                  {tool.label}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sudo mode */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3" data-testid="sudo-toggle">
            <Switch
              id="sudo-toggle-sw"
              checked={settings.permissions.sudoEnabled}
              onChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  permissions: { ...prev.permissions, sudoEnabled: v },
                }))
              }
            />
            <div>
              <label
                htmlFor="sudo-toggle-sw"
                className="text-sm text-white font-medium cursor-pointer"
              >
                Enable sudo for shell commands
              </label>
              <p className="text-xs text-yellow-600 mt-0.5">
                Warning: granting sudo access allows the agent to run privileged commands. Use with
                caution.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* URL controls */}
      <Card>
        <CardHeader>
          <CardTitle>URL Controls</CardTitle>
          <CardDescription>Restrict outbound HTTP requests made by the agent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3" data-testid="url-whitelist-toggle">
            <Switch
              id="url-whitelist-toggle-sw"
              checked={settings.permissions.urlWhitelistMode}
              onChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  permissions: { ...prev.permissions, urlWhitelistMode: v },
                }))
              }
            />
            <div>
              <label
                htmlFor="url-whitelist-toggle-sw"
                className="text-sm text-white font-medium cursor-pointer"
              >
                URL allowlist mode
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                When enabled, only URLs on the allowlist can be accessed.
              </p>
            </div>
          </div>

          {settings.permissions.urlWhitelistMode && (
            <div className="pl-11">
              <UrlList
                label="Allowed URLs"
                urls={settings.permissions.allowedUrls}
                onAdd={addAllowedUrl}
                onRemove={removeAllowedUrl}
              />
            </div>
          )}

          <Separator />

          <UrlList
            label="Blocked URLs (always enforced)"
            urls={settings.permissions.blockedUrls}
            onAdd={addBlockedUrl}
            onRemove={removeBlockedUrl}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Tab: Telemetry ----

function TelemetryTab({
  settings,
  setSettings,
  onSave,
  saved,
}: {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => void
  saved: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Telemetry</h2>
          <p className="text-xs text-gray-500 mt-0.5">Observability and tracing configuration.</p>
        </div>
        <SaveButton onSave={onSave} saved={saved} />
      </div>

      <Card>
        <CardContent className="pt-4 space-y-5">
          <div className="flex items-start gap-3" data-testid="telemetry-toggle">
            <Switch
              id="telemetry-toggle-sw"
              checked={settings.telemetry.enabled}
              onChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  telemetry: { ...prev.telemetry, enabled: v },
                }))
              }
            />
            <div>
              <label
                htmlFor="telemetry-toggle-sw"
                className="text-sm text-white font-medium cursor-pointer"
              >
                Enable OpenTelemetry
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Sends traces and metrics to an OpenTelemetry-compatible backend (e.g. Jaeger,
                Grafana Tempo, Honeycomb). No data is sent to Anthropic or third parties — only to
                the endpoint you configure below.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="otel-endpoint">OTel Endpoint URL</Label>
            <Input
              id="otel-endpoint"
              data-testid="otel-endpoint"
              placeholder="http://localhost:4318/v1/traces"
              value={settings.telemetry.otelEndpoint}
              disabled={!settings.telemetry.enabled}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  telemetry: { ...prev.telemetry, otelEndpoint: e.target.value },
                }))
              }
            />
            <p className="text-xs text-gray-600 mt-1.5">
              OTLP HTTP endpoint. Must accept JSON or protobuf traces.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Tab: Memory ----

function MemoryTab({
  settings,
  setSettings,
  onSave,
  saved,
}: {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => void
  saved: boolean
}) {
  const models = settings.llm.models
  const mem = settings.memory ?? { observationModelId: 'auto' }

  function setMem(patch: { observationModelId?: string; fallbackModelId?: string | undefined }) {
    setSettings((prev) => {
      const merged = { ...prev.memory, ...patch }
      const memory: Settings['memory'] = { observationModelId: merged.observationModelId }
      if (merged.fallbackModelId) memory.fallbackModelId = merged.fallbackModelId
      return { ...prev, memory }
    })
  }

  const MODEL_OPTIONS = [
    {
      id: 'auto',
      label: 'Auto (Anthropic haiku → local Ollama)',
      description: 'Uses ANTHROPIC_API_KEY if set, otherwise falls back to local Ollama',
    },
    {
      id: 'disabled',
      label: 'Disabled',
      description: 'Turn off ObservationalMemory synthesis entirely',
    },
    ...models.map((m) => ({
      id: m.id,
      label: `${m.name} (${m.provider})`,
      description: `${m.provider} · ${m.modelId}`,
    })),
  ]

  const FALLBACK_OPTIONS = [
    { id: '', label: 'None' },
    ...models.map((m) => ({ id: m.id, label: `${m.name} (${m.provider})` })),
  ]

  const selectedPrimary = MODEL_OPTIONS.find((o) => o.id === mem.observationModelId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white">Memory</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Configure how the agent synthesizes and recalls conversation history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ObservationalMemory</CardTitle>
          <CardDescription>
            A background LLM that reads conversation history and synthesizes structured observations
            — facts, decisions, user preferences. These observations persist across all chat
            sessions. Equivalent to mem0, runs locally or via API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Primary synthesis model</Label>
            <Select
              value={mem.observationModelId}
              onChange={(e) => setMem({ observationModelId: e.target.value })}
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            {selectedPrimary && (
              <p className="text-[11px] text-gray-600">{selectedPrimary.description}</p>
            )}
          </div>

          {mem.observationModelId !== 'disabled' && (
            <div className="space-y-2">
              <Label>Fallback model</Label>
              <Select
                value={mem.fallbackModelId ?? ''}
                onChange={(e) =>
                  setMem(
                    e.target.value
                      ? { fallbackModelId: e.target.value }
                      : { fallbackModelId: undefined },
                  )
                }
              >
                {FALLBACK_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-gray-600">
                Used if the primary model fails. Typically a faster/cheaper model.
              </p>
            </div>
          )}

          <Separator />

          <div className="rounded-lg bg-gray-900 border border-gray-800 p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-gray-400">Recommended models by use case</p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600">
              <span className="font-mono">claude-haiku-4-5-20251001</span>
              <span>Best quality, cheapest cloud ($0.25/MTok)</span>
              <span className="font-mono">qwen2.5:3b</span>
              <span>Best local — excellent summarization, 2GB RAM</span>
              <span className="font-mono">llama3.2</span>
              <span>Good local fallback, widely available</span>
              <span className="font-mono">llama3.2:1b</span>
              <span>Minimal resources, 800MB RAM</span>
            </div>
            <p className="text-[11px] text-gray-700 pt-1">
              To add a model, configure it in the Models tab first, then select it here.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SaveButton onSave={onSave} saved={saved} />
      </div>
    </div>
  )
}

// ---- Tab: Expose ----

interface TunnelStatus {
  installed: boolean
  running: boolean
  url: string | null
  pid: number | null
}

interface AuthStatus {
  enabled: boolean
  username: string
  totpEnabled: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

function TunnelSection() {
  const [status, setStatus] = useState<TunnelStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/expose')
      setStatus((await res.json()) as TunnelStatus)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void poll()
    const t = setInterval(() => void poll(), 5000)
    return () => clearInterval(t)
  }, [poll])

  async function start() {
    setLoading(true)
    await fetch('/api/expose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', port: 3000 }),
    })
    setLoading(false)
    await poll()
  }

  async function stop() {
    setLoading(true)
    await fetch('/api/expose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    })
    setLoading(false)
    await poll()
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 py-4">
        <RefreshCw size={14} className="text-gray-600 animate-spin" />
        <span className="text-xs text-gray-600">Checking tunnel…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="tunnel-section">
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-xl border',
          status.running ? 'bg-green-900/20 border-green-800/50' : 'bg-gray-900/60 border-gray-800',
        )}
      >
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            status.running ? 'bg-green-400 animate-pulse' : 'bg-gray-600',
          )}
        />
        <div className="flex-1 min-w-0">
          {status.running && status.url ? (
            <>
              <p className="text-xs font-medium text-white mb-0.5">Tunnel active</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-green-300 truncate">{status.url}</span>
                <CopyButton text={status.url} />
                <a
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-400"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              Tunnel not running — dashboard accessible at localhost:3000 only
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {status.running ? (
            <Button variant="outline" size="sm" onClick={() => void stop()} disabled={loading}>
              <WifiOff size={12} className="mr-1" />
              Stop
            </Button>
          ) : status.installed ? (
            <Button variant="default" size="sm" onClick={() => void start()} disabled={loading}>
              <Wifi size={12} className="mr-1" />
              Start tunnel
            </Button>
          ) : null}
        </div>
      </div>

      {!status.installed && (
        <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-800/40 rounded-xl">
          <AlertTriangle size={15} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white mb-1">cloudflared not installed</p>
            <p className="text-xs text-gray-400 mb-2">Install to expose the dashboard publicly.</p>
            <div className="bg-gray-900 rounded-lg p-3 flex items-center gap-2">
              <Terminal size={12} className="text-gray-600 flex-shrink-0" />
              <code className="text-[11px] text-green-300 font-mono flex-1">
                brew install cloudflare/cloudflare/cloudflared
              </code>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl">
        <Smartphone size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          Once the tunnel is running, open the URL on any device.
        </p>
      </div>

      {status.running && status.url && (
        <div>
          <button
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => {
              const el = document.getElementById('dns-instructions')
              if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
            }}
          >
            <ChevronRight size={13} />
            Use a custom domain (DNS instructions)
          </button>
          <div
            id="dns-instructions"
            style={{ display: 'none' }}
            className="mt-3 p-4 border border-gray-800 rounded-xl"
          >
            <p className="text-xs text-gray-500 mb-2">Add a CNAME record pointing to:</p>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-2">
              <code className="text-xs font-mono text-gray-300 flex-1">
                {status.url.replace(/^https?:\/\//, '')}
              </code>
              <CopyButton text={status.url.replace(/^https?:\/\//, '')} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AuthSection() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved2fa, setSaved2fa] = useState(false)
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')

  const loadAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth')
      setAuth((await res.json()) as AuthStatus)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void loadAuth()
  }, [loadAuth])

  async function saveAuth(enable: boolean) {
    setSaving(true)
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setup',
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
        ...(enable ? {} : { disableAuth: true }),
      }),
    })
    setSaving(false)
    setSaved2fa(true)
    setTimeout(() => setSaved2fa(false), 2000)
    await loadAuth()
    setNewPassword('')
  }

  async function startTotpSetup() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'totp-setup' }),
    })
    const data = (await res.json()) as { secret?: string; qrDataUrl?: string }
    if (data.secret && data.qrDataUrl)
      setTotpSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl })
  }

  async function confirmTotp() {
    if (!totpSetup || totpCode.length !== 6) return
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'totp-confirm', code: totpCode, secret: totpSetup.secret }),
    })
    setTotpSetup(null)
    setTotpCode('')
    await loadAuth()
  }

  async function disableTotp() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'totp-disable' }),
    })
    await loadAuth()
  }

  if (!auth)
    return (
      <div className="flex items-center gap-2 py-4">
        <RefreshCw size={14} className="text-gray-600 animate-spin" />
        <span className="text-xs text-gray-600">Loading…</span>
      </div>
    )

  return (
    <div className="space-y-6" data-testid="auth-section">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Require login</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Protect the dashboard with username and password
          </p>
        </div>
        <Switch checked={auth.enabled} onChange={(v) => void saveAuth(v)} disabled={saving} />
      </div>

      {!auth.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => void saveAuth(true)}
            disabled={saving || !newUsername.trim() || !newPassword.trim()}
          >
            {saved2fa ? (
              <>
                <Check size={13} className="mr-1" />
                Saved
              </>
            ) : (
              'Enable auth'
            )}
          </Button>
        </div>
      )}

      {auth.enabled && (
        <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800/40 rounded-lg">
          <Shield size={13} className="text-green-400" />
          <p className="text-xs text-green-300">
            Authentication active — logged in as <span className="font-mono">{auth.username}</span>
          </p>
        </div>
      )}

      {auth.enabled && (
        <div className="space-y-3 pt-3 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Two-factor authentication</p>
              <p className="text-xs text-gray-500 mt-0.5">TOTP via authenticator app</p>
            </div>
            {auth.totpEnabled ? (
              <Button variant="outline" size="sm" onClick={() => void disableTotp()}>
                Disable 2FA
              </Button>
            ) : !totpSetup ? (
              <Button variant="default" size="sm" onClick={() => void startTotpSetup()}>
                Set up 2FA
              </Button>
            ) : null}
          </div>

          {totpSetup && (
            <div className="space-y-4 p-4 border border-gray-800 rounded-xl">
              <p className="text-xs text-gray-400">
                Scan this QR code with your authenticator app.
              </p>
              <img src={totpSetup.qrDataUrl} alt="TOTP QR code" className="w-40 h-40 rounded-lg" />
              <div className="flex items-center gap-2">
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-28 font-mono text-center"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void confirmTotp()}
                  disabled={totpCode.length !== 6}
                >
                  Verify
                </Button>
              </div>
            </div>
          )}

          {auth.totpEnabled && (
            <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800/40 rounded-lg">
              <Shield size={13} className="text-green-400" />
              <p className="text-xs text-green-300">2FA active</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExposeTab() {
  return (
    <div className="space-y-8 py-2">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Public tunnel
          </h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            <TunnelSection />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Authentication
          </h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            <AuthSection />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Security tips
          </h2>
        </div>
        <Card>
          <CardContent className="pt-4 space-y-2 text-xs text-gray-400">
            <p>• Always enable authentication before exposing publicly</p>
            <p>• Use TOTP 2FA for stronger protection</p>
            <p>• Stop the tunnel when not needed</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

// ---- Tab: Build Health ----

interface FeatureResult {
  id: string
  title: string
  result: string
  ts: string
}

interface NightlyResult {
  date: string
  status: string
  run_id: string
}

function BuildHealthTab() {
  const [regressions, setRegressions] = useState<FeatureResult[]>([])
  const [nightly, setNightly] = useState<NightlyResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/build-health')
      .then((r) => r.json())
      .then((data: { regressions: FeatureResult[]; nightly: NightlyResult[] }) => {
        setRegressions(data.regressions ?? [])
        setNightly(data.nightly ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Build Health</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Regressions</CardTitle>
          <CardDescription>Last 20 regression events from feature test history</CardDescription>
        </CardHeader>
        <CardContent>
          <div data-testid="regressions-section">
            {loading ? (
              <p className="text-xs text-gray-600">Loading…</p>
            ) : regressions.length === 0 ? (
              <p className="text-xs text-green-400" data-testid="no-regressions">
                No regressions detected
              </p>
            ) : (
              <ul className="space-y-1.5">
                {regressions.map((r, i) => (
                  <li
                    key={i}
                    data-testid={`regression-${r.id}`}
                    className="text-xs text-red-400 font-mono"
                  >
                    REGRESSION: {r.id} — {r.title} <span className="text-gray-600">({r.ts})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nightly Runs</CardTitle>
          <CardDescription>Last 7 days of CI runs</CardDescription>
        </CardHeader>
        <CardContent>
          <div data-testid="nightly-section">
            {loading ? (
              <p className="text-xs text-gray-600">Loading…</p>
            ) : nightly.length === 0 ? (
              <p className="text-xs text-gray-600">No nightly runs recorded yet</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-600 border-b border-gray-800">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 font-mono">Run ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {nightly.map((n, i) => (
                    <tr key={i} data-testid={`nightly-row-${n.date}`}>
                      <td className="py-2 text-gray-400">{n.date}</td>
                      <td
                        className={cn(
                          'py-2 font-semibold',
                          n.status === 'success' ? 'text-green-400' : 'text-red-400',
                        )}
                      >
                        {n.status}
                      </td>
                      <td className="py-2 font-mono text-gray-600">{n.run_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>STUCK.md Files</CardTitle>
          <CardDescription>Active blockers flagged by the agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div data-testid="stuck-section">
            <p className="text-xs text-gray-600">No STUCK.md files found</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Tab: About ----

function AboutTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white">About</h2>
        <p className="text-xs text-gray-500 mt-0.5">System information and links.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">App version</span>
            <Badge variant="default">0.1.0</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Runtime</span>
            <span className="text-xs text-gray-300">Node.js</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Platform</span>
            <span className="text-xs text-gray-300 font-mono">
              {typeof navigator !== 'undefined' ? navigator.platform : 'unknown'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">GitHub repository</span>
            <a
              href="https://github.com/open-greg/open-greg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              github.com/open-greg
            </a>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Documentation</span>
            <a
              href="https://docs.open-greg.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              docs.open-greg.dev
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Main Page ----

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [savedTab, setSavedTab] = useState<string | null>(null)

  useEffect(() => {
    void fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = (await res.json()) as Partial<Settings>
      setSettings((prev) => ({ ...prev, ...data }))
    } catch {
      // keep defaults
    }
  }

  function handleSave(tab: string) {
    void (async () => {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        })
      } catch {
        // silently fail
      }
      setSavedTab(tab)
      setTimeout(() => setSavedTab(null), 2000)
    })()
  }

  return (
    <main className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure open-greg agent behavior and integrations.
          </p>
        </div>

        <Tabs defaultValue="models">
          <TabsList>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="messaging">Messaging</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="vision-voice">Vision and Voice</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
            <TabsTrigger value="expose">Expose</TabsTrigger>
            <TabsTrigger value="build-health">Build Health</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="models">
            <ModelsTab />
          </TabsContent>

          <TabsContent value="messaging">
            <MessagingTab />
          </TabsContent>

          <TabsContent value="memory">
            <MemoryTab
              settings={settings}
              setSettings={setSettings}
              onSave={() => handleSave('memory')}
              saved={savedTab === 'memory'}
            />
          </TabsContent>

          <TabsContent value="vision-voice">
            <VisionVoiceTab
              settings={settings}
              setSettings={setSettings}
              onSave={() => handleSave('vision-voice')}
              saved={savedTab === 'vision-voice'}
            />
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsTab
              settings={settings}
              setSettings={setSettings}
              onSave={() => handleSave('permissions')}
              saved={savedTab === 'permissions'}
            />
          </TabsContent>

          <TabsContent value="telemetry">
            <TelemetryTab
              settings={settings}
              setSettings={setSettings}
              onSave={() => handleSave('telemetry')}
              saved={savedTab === 'telemetry'}
            />
          </TabsContent>

          <TabsContent value="expose">
            <ExposeTab />
          </TabsContent>

          <TabsContent value="build-health">
            <BuildHealthTab />
          </TabsContent>

          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
