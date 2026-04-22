'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Bot } from 'lucide-react'
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
  systemPrompt: string
  tools: AgentTools
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'ollama/llama3.2',
  'ollama/qwen2.5:14b',
  'gpt-4o',
  'gpt-4o-mini',
] as const

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
    model: 'claude-sonnet-4-6',
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

// ─── Agent Form (inside Dialog) ───────────────────────────────────────────────

interface AgentFormData {
  handle: string
  name: string
  model: string
  systemPrompt: string
  tools: AgentTools
}

interface AgentDialogProps {
  open: boolean
  initial: AgentFormData | null
  isEditing: boolean
  existingHandles: string[]
  onClose: () => void
  onSave: (data: AgentFormData) => void | Promise<void>
}

function AgentDialog({
  open,
  initial,
  isEditing,
  existingHandles,
  onClose,
  onSave,
}: AgentDialogProps) {
  const [form, setForm] = useState<AgentFormData>({
    handle: '',
    name: '',
    model: 'claude-sonnet-4-6',
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
          model: 'claude-sonnet-4-6',
          systemPrompt: '',
          tools: { ...DEFAULT_TOOLS },
        },
      )
      setHandleError(null)
    }
  }, [open, initial])

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
    onSave(form)
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
        {/* Handle */}
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

        {/* Name */}
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

        {/* Model */}
        <div>
          <Label htmlFor="agent-model">Model</Label>
          <Select
            id="agent-model"
            value={form.model}
            onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>

        {/* System Prompt */}
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

        {/* Tools */}
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

        {/* Actions */}
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
  onEdit: (agent: Agent) => void
  onDelete: (handle: string) => void | Promise<void>
}

function AgentCard({ agent, isPrimary, onEdit, onDelete }: AgentCardProps) {
  const enabledTools = TOOL_NAMES.filter((t) => agent.tools[t])

  return (
    <Card data-testid={`agent-item-${agent.handle}`} className="flex flex-col">
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
            {agent.model}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-3">
        {/* System prompt preview */}
        {agent.systemPrompt ? (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{agent.systemPrompt}</p>
        ) : (
          <p className="text-xs text-gray-700 italic">No system prompt</p>
        )}

        {/* Tools */}
        {enabledTools.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
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
          data-testid={`edit-${agent.handle}`}
          onClick={() => onEdit(agent)}
        >
          <Pencil size={13} />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`delete-${agent.handle}`}
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data: { agents: Agent[] }) => setAgents(data.agents))
      .catch(() => setAgents(INITIAL_AGENTS))
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
      await fetch(`/api/agents/${editingAgent.handle}`, {
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
    if (!window.confirm(`Delete agent @${handle}?`)) return
    await fetch(`/api/agents/${handle}`, { method: 'DELETE' })
    setAgents((prev) => prev.filter((a) => a.handle !== handle))
  }

  const existingHandles = agents.map((a) => a.handle)
  const editFormData: AgentFormData | null = editingAgent
    ? {
        handle: editingAgent.handle,
        name: editingAgent.name,
        model: editingAgent.model,
        systemPrompt: editingAgent.systemPrompt,
        tools: editingAgent.tools,
      }
    : null

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <Button data-testid="new-agent-button" onClick={openNew}>
          <Plus size={15} />
          New Agent
        </Button>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
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
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </main>
  )
}
