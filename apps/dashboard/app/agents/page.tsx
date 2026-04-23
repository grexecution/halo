'use client'

import { useState, useEffect } from 'react'
import { CardGridSkeleton } from '../components/ui/skeleton'
import { Plus, Pencil, Trash2, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import {
  cn,
  Button,
  Badge,
  Input,
  Textarea,
  Label,
  Select,
  Switch,
  Dialog,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  EmptyState,
} from '../components/ui/index'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolName = 'shell' | 'browser' | 'filesystem' | 'gui'

interface AgentTools {
  shell: boolean
  browser: boolean
  filesystem: boolean
  gui: boolean
}

interface Agent {
  handle: string
  name: string
  model: string
  fallbackModels: string[]
  systemPrompt: string
  tools: AgentTools
}

interface AvailableModel {
  modelId: string // settings ID — stored as agent.model
  name: string
  provider: string
  subModelId?: string // actual model name for display (e.g. "llama3.2:1b")
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_NAMES: ToolName[] = ['shell', 'browser', 'filesystem', 'gui']

const DEFAULT_TOOLS: AgentTools = {
  shell: false,
  browser: false,
  filesystem: false,
  gui: false,
}

const INITIAL_AGENTS: Agent[] = [
  {
    handle: 'main',
    name: 'Main Agent',
    model: 'llama3.2',
    fallbackModels: [],
    systemPrompt: 'You are a helpful AI assistant.',
    tools: DEFAULT_TOOLS,
  },
]

// ─── Handle validation ────────────────────────────────────────────────────────

const HANDLE_RE = /^[a-zA-Z0-9-]+$/

function validateHandle(value: string): string | null {
  if (!value.trim()) return 'Handle is required'
  if (!HANDLE_RE.test(value)) return 'Handle may only contain letters, numbers, and hyphens'
  return null
}

// ─── Fallback model picker ────────────────────────────────────────────────────

interface FallbackPickerProps {
  primaryModel: string
  selected: string[]
  models: AvailableModel[]
  onChange: (models: string[]) => void
}

function FallbackPicker({ primaryModel, selected, models, onChange }: FallbackPickerProps) {
  const [open, setOpen] = useState(false)
  const candidates = models.filter((m) => m.modelId !== primaryModel)

  function toggle(modelId: string) {
    if (selected.includes(modelId)) {
      onChange(selected.filter((m) => m !== modelId))
    } else {
      onChange([...selected, modelId])
    }
  }

  return (
    <div>
      <Label>Fallback Models</Label>
      <p className="text-[11px] text-gray-500 mb-1">
        Used in order if the primary model fails or is unavailable.
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-gray-500 transition-colors"
      >
        <span>
          {selected.length === 0
            ? 'No fallbacks'
            : selected.length === 1
              ? '1 fallback selected'
              : selected.length + ' fallbacks selected'}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-1 border border-gray-700 rounded-lg bg-gray-900 divide-y divide-gray-800 max-h-48 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">
              No other models configured. Add models in Settings → Models.
            </p>
          ) : (
            candidates.map((m, idx) => {
              const checked = selected.includes(m.modelId)
              const rank = selected.indexOf(m.modelId) + 1
              return (
                <label
                  key={m.modelId}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-800/60 transition-colors',
                    idx === 0 && 'rounded-t-lg',
                    idx === candidates.length - 1 && 'rounded-b-lg',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={checked}
                    onChange={() => toggle(m.modelId)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono truncate">
                      {m.subModelId ?? m.modelId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="muted" className="text-[10px] capitalize">
                      {m.provider}
                    </Badge>
                    {checked && (
                      <span className="text-[10px] text-blue-400 font-mono">#{rank}</span>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((id, i) => {
            const m = models.find((x) => x.modelId === id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-[11px] text-gray-300"
              >
                <span className="text-blue-400 font-mono">#{i + 1}</span>
                {m?.name ?? id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="ml-0.5 text-gray-500 hover:text-red-400"
                >
                  x
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Agent Form (inside Dialog) ───────────────────────────────────────────────

interface AgentFormData {
  handle: string
  name: string
  model: string
  fallbackModels: string[]
  systemPrompt: string
  tools: AgentTools
}

interface AgentDialogProps {
  open: boolean
  initial: AgentFormData | null
  isEditing: boolean
  existingHandles: string[]
  availableModels: AvailableModel[]
  onClose: () => void
  onSave: (data: AgentFormData) => void | Promise<void>
}

function AgentDialog({
  open,
  initial,
  isEditing,
  existingHandles,
  availableModels,
  onClose,
  onSave,
}: AgentDialogProps) {
  const [form, setForm] = useState<AgentFormData>({
    handle: '',
    name: '',
    model: availableModels[0]?.modelId ?? 'claude-sonnet-4-6',
    fallbackModels: [],
    systemPrompt: '',
    tools: DEFAULT_TOOLS,
  })
  const [handleError, setHandleError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(
        initial ?? {
          handle: '',
          name: '',
          model: availableModels[0]?.modelId ?? 'claude-sonnet-4-6',
          fallbackModels: [],
          systemPrompt: '',
          tools: { ...DEFAULT_TOOLS },
        },
      )
      setHandleError(null)
    }
  }, [open, initial, availableModels])

  function handleHandleChange(value: string) {
    setForm((p) => ({ ...p, handle: value }))
    const err = validateHandle(value)
    if (err) {
      setHandleError(err)
      return
    }
    if (!isEditing && existingHandles.includes(value)) {
      setHandleError('Handle already in use')
      return
    }
    setHandleError(null)
  }

  function setTool(tool: ToolName, enabled: boolean) {
    setForm((p) => ({ ...p, tools: { ...p.tools, [tool]: enabled } }))
  }

  function handleSave() {
    const err = validateHandle(form.handle)
    if (err) {
      setHandleError(err)
      return
    }
    if (!form.name.trim()) return
    const cleanedFallbacks = form.fallbackModels.filter((m) => m !== form.model)
    onSave({ ...form, fallbackModels: cleanedFallbacks })
  }

  const canSave = !handleError && form.handle.trim() !== '' && form.name.trim() !== ''

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Agent' : 'New Agent'}
      description="Configure an AI agent with its model and capabilities."
      className="max-w-xl"
    >
      <div data-testid="agent-form" className="space-y-4">
        <div>
          <Label htmlFor="agent-handle">Handle</Label>
          <Input
            id="agent-handle"
            data-testid="handle-input"
            value={form.handle}
            onChange={(e) => handleHandleChange(e.target.value)}
            placeholder="my-agent"
            disabled={isEditing}
            className={cn('font-mono', isEditing && 'opacity-60 cursor-not-allowed')}
          />
          {handleError && <p className="text-[11px] text-red-400 mt-1">{handleError}</p>}
        </div>

        <div>
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            data-testid="name-input"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Agent display name"
          />
        </div>

        <div>
          <Label htmlFor="agent-model">Primary Model</Label>
          <Select
            id="agent-model"
            value={form.model}
            onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
          >
            {availableModels.length === 0 ? (
              <option value={form.model}>{form.model}</option>
            ) : (
              availableModels.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.name}
                  {m.subModelId && m.subModelId !== m.name ? ` · ${m.subModelId}` : ''} [
                  {m.provider}]
                </option>
              ))
            )}
          </Select>
        </div>

        <FallbackPicker
          primaryModel={form.model}
          selected={form.fallbackModels}
          models={availableModels}
          onChange={(models) => setForm((p) => ({ ...p, fallbackModels: models }))}
        />

        <div>
          <Label htmlFor="agent-system-prompt">System Prompt</Label>
          <Textarea
            id="agent-system-prompt"
            data-testid="system-prompt-input"
            value={form.systemPrompt}
            onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
            placeholder="You are a helpful AI assistant."
            rows={6}
          />
        </div>

        <div>
          <Label>Tools Enabled</Label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {TOOL_NAMES.map((tool) => (
              <div
                key={tool}
                className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2"
              >
                <span className="text-sm text-gray-300 capitalize">{tool}</span>
                <Switch checked={form.tools[tool]} onChange={(v) => setTool(tool, v)} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="save-agent-button" onClick={handleSave} disabled={!canSave}>
            {isEditing ? 'Save Changes' : 'Create Agent'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent
  isPrimary: boolean
  availableModels: AvailableModel[]
  onEdit: (agent: Agent) => void
  onDelete: (handle: string) => void | Promise<void>
}

function AgentCard({ agent, isPrimary, availableModels, onEdit, onDelete }: AgentCardProps) {
  const enabledTools = TOOL_NAMES.filter((t) => agent.tools[t])
  const primaryLabel = availableModels.find((m) => m.modelId === agent.model)?.name ?? agent.model

  return (
    <Card data-testid={'agent-item-' + agent.handle} className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono font-semibold text-blue-400">@{agent.handle}</span>
              {isPrimary && <Badge variant="info">Primary</Badge>}
            </div>
            <p className="text-sm text-white mt-0.5">{agent.name}</p>
          </div>
          <Badge variant="muted" className="shrink-0 text-[10px]">
            {primaryLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-3 space-y-2">
        {agent.systemPrompt ? (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{agent.systemPrompt}</p>
        ) : (
          <p className="text-xs text-gray-700 italic">No system prompt</p>
        )}

        {agent.fallbackModels.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Fallbacks</p>
            <div className="flex flex-wrap gap-1">
              {agent.fallbackModels.map((id, i) => {
                const label = availableModels.find((m) => m.modelId === id)?.name ?? id
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400"
                  >
                    <span className="text-blue-500 font-mono">#{i + 1}</span>
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {enabledTools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {enabledTools.map((t) => (
              <Badge key={t} variant="default" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-end gap-1 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          data-testid={'edit-' + agent.handle}
          onClick={() => onEdit(agent)}
        >
          <Pencil size={13} />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={'delete-' + agent.handle}
          onClick={() => onDelete(agent.handle)}
          className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
        >
          <Trash2 size={13} />
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsFetched, setAgentsFetched] = useState(false)
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => setAgents((data as { agents: Agent[] }).agents))
      .catch(() => setAgents(INITIAL_AGENTS))
      .finally(() => setAgentsFetched(true))

    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        const d = data as {
          models?: Array<{
            id: string
            name: string
            provider: string
            modelId: string
            enabled: boolean
            isDiscovered?: boolean
          }>
        }
        // Only show enabled, configured models (not discovered-only stubs)
        const models = (d.models ?? [])
          .filter((m) => m.enabled !== false && !m.isDiscovered)
          .map((m) => ({
            modelId: m.id, // settings key — used as agent.model value
            name: m.name,
            provider: m.provider,
            subModelId: m.modelId, // actual model name for display
          }))
        setAvailableModels(models)
      })
      .catch(() => {
        setAvailableModels([
          {
            modelId: 'claude-sonnet-4-6',
            name: 'Claude Sonnet',
            provider: 'anthropic',
            subModelId: 'claude-sonnet-4-6',
          },
          {
            modelId: 'claude-haiku-4-5-20251001',
            name: 'Claude Haiku',
            provider: 'anthropic',
            subModelId: 'claude-haiku-4-5-20251001',
          },
          { modelId: 'gpt-4o', name: 'GPT-4o', provider: 'openai', subModelId: 'gpt-4o' },
        ])
      })
  }, [])

  function openNew() {
    setEditingAgent(null)
    setDialogOpen(true)
  }

  function openEdit(agent: Agent) {
    setEditingAgent(agent)
    setDialogOpen(true)
  }

  async function handleSave(data: AgentFormData) {
    if (editingAgent) {
      await fetch('/api/agents/' + editingAgent.handle, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setAgents((prev) =>
        prev.map((a) => (a.handle === editingAgent.handle ? { ...a, ...data } : a)),
      )
    } else {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setAgents((prev) => [...prev, data])
    }
    setDialogOpen(false)
    setEditingAgent(null)
  }

  async function handleDelete(handle: string) {
    if (!window.confirm('Delete agent @' + handle + '?')) return
    await fetch('/api/agents/' + handle, { method: 'DELETE' })
    setAgents((prev) => prev.filter((a) => a.handle !== handle))
  }

  const existingHandles = agents.map((a) => a.handle)
  const editFormData: AgentFormData | null = editingAgent
    ? {
        handle: editingAgent.handle,
        name: editingAgent.name,
        model: editingAgent.model,
        fallbackModels: editingAgent.fallbackModels ?? [],
        systemPrompt: editingAgent.systemPrompt,
        tools: editingAgent.tools,
      }
    : null

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <Button data-testid="new-agent-button" onClick={openNew}>
          <Plus size={15} />
          New Agent
        </Button>
      </div>

      {!agentsFetched ? (
        <CardGridSkeleton count={3} cols={3} />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Bot size={36} />}
          title="No agents yet"
          description="Create an agent to get started"
          action={
            <Button onClick={openNew}>
              <Plus size={15} />
              New Agent
            </Button>
          }
        />
      ) : (
        <div data-testid="agent-list" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {agents.map((agent, idx) => (
            <AgentCard
              key={agent.handle}
              agent={agent}
              isPrimary={idx === 0}
              availableModels={availableModels}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AgentDialog
        open={dialogOpen}
        initial={editFormData}
        isEditing={editingAgent !== null}
        existingHandles={existingHandles}
        availableModels={availableModels}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </main>
  )
}
