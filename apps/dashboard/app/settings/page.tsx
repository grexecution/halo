'use client'
import { useState, useEffect } from 'react'
import { Star, StarOff, Trash2, Plus, X, Info } from 'lucide-react'
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
  Dialog,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
} from '../components/ui/index'

// ---- Types ----

interface LLMModel {
  id: string
  provider: 'ollama' | 'anthropic' | 'openai' | 'custom'
  name: string
  modelId: string
  apiKey?: string
  baseUrl?: string
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
}

interface LiveModel {
  id: string
  name: string
  provider: string
  available: boolean
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
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  custom: 'Custom',
}

const PROVIDER_BADGE_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'muted'> =
  {
    ollama: 'success',
    anthropic: 'info',
    openai: 'default',
    custom: 'muted',
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

// ---- Add Model Dialog ----

interface AddModelDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (model: LLMModel) => void
}

function AddModelDialog({ open, onClose, onAdd }: AddModelDialogProps) {
  const [provider, setProvider] = useState<LLMModel['provider']>('ollama')
  const [name, setName] = useState('')
  const [modelId, setModelId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')

  function reset() {
    setProvider('ollama')
    setName('')
    setModelId('')
    setApiKey('')
    setBaseUrl('')
  }

  function handleAdd() {
    if (!name.trim() || !modelId.trim()) return
    const newModel: LLMModel = {
      id: `${provider}-${Date.now()}`,
      provider,
      name: name.trim(),
      modelId: modelId.trim(),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    }
    onAdd(newModel)
    reset()
    onClose()
  }

  function handleClose() {
    reset()
    onClose()
  }

  const showApiKey = provider === 'anthropic' || provider === 'openai' || provider === 'custom'
  const showBaseUrl = provider === 'openai' || provider === 'custom'

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add Model"
      description="Configure a new language model."
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="add-provider">Provider</Label>
          <Select
            id="add-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as LLMModel['provider'])}
          >
            <option value="ollama">Ollama</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="custom">Custom</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="add-name">Name</Label>
          <Input
            id="add-name"
            placeholder="e.g. My Llama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="add-modelid">Model ID</Label>
          <Input
            id="add-modelid"
            placeholder="e.g. llama3:8b"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          />
        </div>
        {showApiKey && (
          <div>
            <Label htmlFor="add-apikey">API Key (optional)</Label>
            <Input
              id="add-apikey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}
        {showBaseUrl && (
          <div>
            <Label htmlFor="add-baseurl">Base URL (optional)</Label>
            <Input
              id="add-baseurl"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim() || !modelId.trim()}
          >
            Add Model
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ---- Tab: Models ----

function ModelsTab({
  settings,
  setSettings,
  liveModels,
  onSave,
  saved,
}: {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  liveModels: LiveModel[]
  onSave: () => void
  saved: boolean
}) {
  const [addOpen, setAddOpen] = useState(false)

  function setPrimary(id: string) {
    setSettings((prev) => ({ ...prev, llm: { ...prev.llm, primary: id } }))
  }

  function deleteModel(id: string) {
    setSettings((prev) => ({
      ...prev,
      llm: {
        ...prev.llm,
        models: prev.llm.models.filter((m) => m.id !== id),
        primary:
          prev.llm.primary === id
            ? (prev.llm.models.find((m) => m.id !== id)?.id ?? '')
            : prev.llm.primary,
      },
    }))
  }

  function addModel(model: LLMModel) {
    setSettings((prev) => ({
      ...prev,
      llm: {
        ...prev.llm,
        models: [...prev.llm.models, model],
        primary: prev.llm.primary || model.id,
      },
    }))
  }

  const primaryModel = settings.llm.models.find((m) => m.id === settings.llm.primary)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Language Models</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure the models available to the agent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveButton onSave={onSave} saved={saved} />
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} />
            Add Model
          </Button>
        </div>
      </div>

      <Card>
        {settings.llm.models.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-500">No models configured.</p>
            <p className="text-xs text-gray-600 mt-1">Click "Add Model" to add one.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {settings.llm.models.map((model) => {
              const isPrimary = model.id === settings.llm.primary
              return (
                <div key={model.id} className="flex items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => setPrimary(model.id)}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      isPrimary ? 'text-yellow-400' : 'text-gray-700 hover:text-yellow-400',
                    )}
                    aria-label={isPrimary ? 'Primary model' : 'Set as primary'}
                  >
                    {isPrimary ? <Star size={15} fill="currentColor" /> : <StarOff size={15} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{model.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{model.modelId}</p>
                  </div>
                  <Badge variant={PROVIDER_BADGE_VARIANT[model.provider] ?? 'default'}>
                    {PROVIDER_LABELS[model.provider] ?? model.provider}
                  </Badge>
                  {isPrimary && <Badge variant="warning">primary</Badge>}
                  <button
                    onClick={() => deleteModel(model.id)}
                    className="flex-shrink-0 p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                    aria-label={`Delete ${model.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {primaryModel && (
        <Card>
          <CardHeader>
            <CardTitle>Primary Model</CardTitle>
            <CardDescription>The default model used for agent tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Star size={14} className="text-yellow-400" fill="currentColor" />
              <span className="text-sm text-white font-medium">{primaryModel.name}</span>
              <Badge variant={PROVIDER_BADGE_VARIANT[primaryModel.provider] ?? 'default'}>
                {PROVIDER_LABELS[primaryModel.provider] ?? primaryModel.provider}
              </Badge>
              <span className="text-xs text-gray-500 font-mono">{primaryModel.modelId}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {liveModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Live Ollama Models</CardTitle>
            <CardDescription>
              Models currently available from the local Ollama server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {liveModels.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 font-mono flex-1">{m.name}</span>
                  {m.available ? (
                    <Badge variant="success">available</Badge>
                  ) : (
                    <Badge variant="muted">unavailable</Badge>
                  )}
                  <Badge variant="info">
                    <Info size={10} className="mr-1" />
                    pull not yet supported
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddModelDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={addModel} />
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
  const [liveModels, setLiveModels] = useState<LiveModel[]>([])
  const [savedTab, setSavedTab] = useState<string | null>(null)

  useEffect(() => {
    void fetchSettings()
    void fetchLiveModels()
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

  async function fetchLiveModels() {
    try {
      const res = await fetch('/api/models')
      const data = (await res.json()) as { models: LiveModel[] }
      setLiveModels(data.models ?? [])
    } catch {
      setLiveModels([])
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
            <TabsTrigger value="vision-voice">Vision and Voice</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="models">
            <ModelsTab
              settings={settings}
              setSettings={setSettings}
              liveModels={liveModels}
              onSave={() => handleSave('models')}
              saved={savedTab === 'models'}
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

          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
