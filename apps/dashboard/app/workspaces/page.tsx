'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Link2,
  Terminal,
  Eye,
  EyeOff,
  Type,
  GripVertical,
  Pencil,
  Check,
  X,
  Briefcase,
  User,
  FolderGit2,
  Users,
  Puzzle,
  ChevronRight,
  Zap,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { Button, Switch, EmptyState, cn } from '../components/ui/index'
import { Skeleton } from '../components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceType = 'client' | 'personal' | 'project' | 'team' | 'custom'
type FieldType = 'text' | 'url' | 'code' | 'secret'

interface WorkspaceField {
  id: string
  key: string
  value: string
  type: FieldType
}

interface WorkspaceDocument {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  description: string
  emoji: string
  fields: WorkspaceField[]
  documents: WorkspaceDocument[]
  active: boolean
  createdAt: string
  updatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  WorkspaceType,
  {
    label: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    color: string
    badgeClass: string
  }
> = {
  client: {
    label: 'Client',
    icon: Briefcase,
    color: 'text-blue-400',
    badgeClass: 'bg-blue-900/40 text-blue-300 border border-blue-800/60',
  },
  personal: {
    label: 'Personal',
    icon: User,
    color: 'text-purple-400',
    badgeClass: 'bg-purple-900/40 text-purple-300 border border-purple-800/60',
  },
  project: {
    label: 'Project',
    icon: FolderGit2,
    color: 'text-green-400',
    badgeClass: 'bg-green-900/40 text-green-300 border border-green-800/60',
  },
  team: {
    label: 'Team',
    icon: Users,
    color: 'text-orange-400',
    badgeClass: 'bg-orange-900/40 text-orange-300 border border-orange-800/60',
  },
  custom: {
    label: 'Custom',
    icon: Puzzle,
    color: 'text-gray-400',
    badgeClass: 'bg-gray-800/60 text-gray-400 border border-gray-700/60',
  },
}

const FIELD_ICON: Record<FieldType, React.ComponentType<{ size?: number; className?: string }>> = {
  text: Type,
  url: Link2,
  code: Terminal,
  secret: Eye,
}

const TEMPLATES: Record<
  WorkspaceType,
  { emoji: string; description: string; fields: Omit<WorkspaceField, 'id'>[] }
> = {
  client: {
    emoji: '🏢',
    description: '',
    fields: [
      { key: 'github', value: '', type: 'url' },
      { key: 'production', value: '', type: 'url' },
      { key: 'staging', value: '', type: 'url' },
      { key: 'local_start', value: 'pnpm dev', type: 'code' },
      { key: 'jira_board', value: '', type: 'url' },
      { key: 'notes', value: '', type: 'text' },
    ],
  },
  personal: {
    emoji: '👤',
    description: '',
    fields: [
      { key: 'name', value: '', type: 'text' },
      { key: 'timezone', value: '', type: 'text' },
      { key: 'goals', value: '', type: 'text' },
      { key: 'preferences', value: '', type: 'text' },
      { key: 'notes', value: '', type: 'text' },
    ],
  },
  project: {
    emoji: '📁',
    description: '',
    fields: [
      { key: 'repo', value: '', type: 'url' },
      { key: 'docs', value: '', type: 'url' },
      { key: 'ci_url', value: '', type: 'url' },
      { key: 'deploy_cmd', value: '', type: 'code' },
      { key: 'notes', value: '', type: 'text' },
    ],
  },
  team: {
    emoji: '👥',
    description: '',
    fields: [
      { key: 'slack_channel', value: '', type: 'text' },
      { key: 'confluence', value: '', type: 'url' },
      { key: 'oncall', value: '', type: 'text' },
      { key: 'runbook', value: '', type: 'url' },
      { key: 'notes', value: '', type: 'text' },
    ],
  },
  custom: {
    emoji: '📝',
    description: '',
    fields: [],
  },
}

function newField(overrides: Partial<WorkspaceField> = {}): WorkspaceField {
  return {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    key: '',
    value: '',
    type: 'text',
    ...overrides,
  }
}

// ─── Document Row ─────────────────────────────────────────────────────────────

interface DocRowProps {
  doc: WorkspaceDocument
  onChange: (d: WorkspaceDocument) => void
  onDelete: () => void
}

function DocumentRow({ doc, onChange, onDelete }: DocRowProps) {
  const [open, setOpen] = useState(doc.content === '')
  const now = new Date().toISOString()
  return (
    <div className="border border-gray-800/60 rounded-xl overflow-hidden mb-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left group"
        >
          <ChevronDown
            size={12}
            className={cn(
              'text-gray-600 transition-transform flex-shrink-0',
              open && 'rotate-0',
              !open && '-rotate-90',
            )}
          />
          <FileText size={12} className="text-gray-600 flex-shrink-0" />
          <input
            className="bg-transparent text-xs font-medium text-gray-300 focus:outline-none focus:text-white flex-1 min-w-0"
            value={doc.title}
            onChange={(e) => onChange({ ...doc, title: e.target.value, updatedAt: now })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Document title"
          />
        </button>
        <button
          onClick={onDelete}
          className="text-gray-700 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={13} />
        </button>
      </div>
      {open && (
        <textarea
          className="w-full bg-gray-950/60 px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none resize-none min-h-[120px] placeholder-gray-700"
          value={doc.content}
          onChange={(e) => onChange({ ...doc, content: e.target.value, updatedAt: now })}
          placeholder="Paste markdown, notes, documentation, README content…"
          rows={8}
        />
      )}
    </div>
  )
}

// ─── Template Picker ──────────────────────────────────────────────────────────

function TemplatePicker({
  onPick,
  loading,
}: {
  onPick: (type: WorkspaceType) => void
  loading?: boolean
}) {
  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-white mb-1">New Workspace</h2>
      <p className="text-xs text-gray-500 mb-5">
        Choose a template to get started quickly — you can customise everything.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {(Object.keys(TYPE_META) as WorkspaceType[]).map((type) => {
          const meta = TYPE_META[type]
          const tmpl = TEMPLATES[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              onClick={() => onPick(type)}
              disabled={loading}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800/80 transition-all text-left group disabled:opacity-50 disabled:cursor-wait"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-700 transition-colors',
                  meta.color,
                )}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {tmpl.emoji} {meta.label}
                  </span>
                  {tmpl.fields.length > 0 && (
                    <span className="text-[10px] text-gray-600">
                      {tmpl.fields.length} default fields
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {type === 'client' && 'GitHub, prod, staging, local start command'}
                  {type === 'personal' && 'Name, timezone, goals, preferences'}
                  {type === 'project' && 'Repo, docs, CI/CD, deploy command'}
                  {type === 'team' && 'Slack, Confluence, oncall rotation'}
                  {type === 'custom' && 'Start from scratch with your own fields'}
                </p>
              </div>
              <ChevronRight
                size={14}
                className="text-gray-700 group-hover:text-gray-400 transition-colors flex-shrink-0"
              />
            </button>
          )
        })}
      </div>
      {loading && <p className="mt-4 text-xs text-gray-600 text-center">Creating workspace…</p>}
    </div>
  )
}

// ─── Field Row ────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: WorkspaceField
  onChange: (f: WorkspaceField) => void
  onDelete: () => void
}

function FieldRow({ field, onChange, onDelete }: FieldRowProps) {
  const [editingKey, setEditingKey] = useState(field.key === '')
  const [keyDraft, setKeyDraft] = useState(field.key)
  const [showSecret, setShowSecret] = useState(false)
  const Icon = FIELD_ICON[field.type]

  function commitKey() {
    setEditingKey(false)
    if (keyDraft.trim()) onChange({ ...field, key: keyDraft.trim() })
  }

  return (
    <div className="group flex items-start gap-2 py-2 border-b border-gray-800/60 last:border-0">
      <div className="flex-shrink-0 mt-2 text-gray-700 cursor-grab">
        <GripVertical size={13} />
      </div>

      {/* Key */}
      <div className="w-36 flex-shrink-0">
        {editingKey ? (
          <input
            autoFocus
            className="w-full bg-gray-800 border border-blue-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onBlur={commitKey}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitKey()
              if (e.key === 'Escape') {
                setEditingKey(false)
                setKeyDraft(field.key)
              }
            }}
            placeholder="field_name"
          />
        ) : (
          <button
            onClick={() => {
              setEditingKey(true)
              setKeyDraft(field.key)
            }}
            className="flex items-center gap-1.5 w-full group/key"
            title="Click to rename"
          >
            <span className="text-xs font-mono text-gray-400 group-hover/key:text-gray-200 transition-colors truncate">
              {field.key || <span className="text-gray-700 italic">unnamed</span>}
            </span>
            <Pencil
              size={10}
              className="text-gray-700 group-hover/key:text-gray-400 flex-shrink-0 opacity-0 group-hover/key:opacity-100 transition-all"
            />
          </button>
        )}
      </div>

      {/* Value */}
      <div className="flex-1 relative">
        {field.type === 'url' ? (
          <input
            className="w-full bg-gray-800/60 rounded px-2 py-1 text-xs text-blue-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-600/50 hover:bg-gray-800 transition-colors"
            value={field.value}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            placeholder="https://"
          />
        ) : field.type === 'code' ? (
          <input
            className="w-full bg-gray-800/60 rounded px-2 py-1 text-xs text-green-300 font-mono focus:outline-none focus:ring-1 focus:ring-green-600/40 hover:bg-gray-800 transition-colors"
            value={field.value}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            placeholder="command"
          />
        ) : field.type === 'secret' ? (
          <input
            type={showSecret ? 'text' : 'password'}
            className="w-full bg-gray-800/60 rounded px-2 py-1 pr-7 text-xs text-yellow-300 font-mono focus:outline-none focus:ring-1 focus:ring-yellow-600/40 hover:bg-gray-800 transition-colors"
            value={field.value}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            placeholder="••••••••"
          />
        ) : field.value.length > 60 ? (
          <textarea
            rows={2}
            className="w-full bg-gray-800/60 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-600/40 hover:bg-gray-800 transition-colors resize-none"
            value={field.value}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            placeholder="value"
          />
        ) : (
          <input
            className="w-full bg-gray-800/60 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-600/40 hover:bg-gray-800 transition-colors"
            value={field.value}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            placeholder="value"
          />
        )}
        {field.type === 'secret' && (
          <button
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
          >
            {showSecret ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>

      {/* Type selector */}
      <div className="flex-shrink-0">
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as FieldType })}
          className="bg-gray-800/60 border border-gray-700/60 rounded px-1.5 py-1 text-[10px] text-gray-500 focus:outline-none hover:border-gray-600 transition-colors"
        >
          <option value="text">text</option>
          <option value="url">url</option>
          <option value="code">code</option>
          <option value="secret">secret</option>
        </select>
      </div>

      {/* Icon + delete */}
      <div className="flex items-center gap-1 flex-shrink-0 mt-1">
        <Icon size={12} className="text-gray-700" />
        <button
          onClick={onDelete}
          className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Workspace Editor ─────────────────────────────────────────────────────────

interface WorkspaceEditorProps {
  workspace: Workspace
  onSave: (ws: Workspace) => Promise<void>
  onDelete: () => void
  saving: boolean
}

function WorkspaceEditor({ workspace, onSave, onDelete, saving }: WorkspaceEditorProps) {
  const [draft, setDraft] = useState<Workspace>(workspace)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(workspace.name)
  const [saved, setSaved] = useState(false)
  const meta = TYPE_META[draft.type]
  const Icon = meta.icon

  useEffect(() => {
    setDraft(workspace)
    setNameDraft(workspace.name)
  }, [workspace.id, workspace]) // reset editor when selected workspace changes

  const dirty = JSON.stringify(draft) !== JSON.stringify(workspace)

  function updateField(idx: number, f: WorkspaceField) {
    setDraft((p) => {
      const fields = [...p.fields]
      fields[idx] = f
      return { ...p, fields }
    })
  }

  function deleteField(idx: number) {
    setDraft((p) => ({ ...p, fields: p.fields.filter((_, i) => i !== idx) }))
  }

  function addField() {
    setDraft((p) => ({ ...p, fields: [...p.fields, newField()] }))
  }

  function updateDoc(idx: number, d: WorkspaceDocument) {
    setDraft((p) => {
      const docs = [...p.documents]
      docs[idx] = d
      return { ...p, documents: docs }
    })
  }

  function deleteDoc(idx: number) {
    setDraft((p) => ({ ...p, documents: p.documents.filter((_, i) => i !== idx) }))
  }

  function addDoc() {
    const now = new Date().toISOString()
    setDraft((p) => ({
      ...p,
      documents: [
        ...p.documents,
        {
          id: `doc-${Date.now()}`,
          title: 'New Document',
          content: '',
          createdAt: now,
          updatedAt: now,
        },
      ],
    }))
  }

  function commitName() {
    setEditingName(false)
    if (nameDraft.trim()) setDraft((p) => ({ ...p, name: nameDraft.trim() }))
  }

  async function handleSave() {
    await onSave(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="text-2xl leading-none hover:scale-110 transition-transform flex-shrink-0"
              title="Change emoji"
              onClick={() => {
                const e = prompt('Enter emoji', draft.emoji)
                if (e) setDraft((p) => ({ ...p, emoji: e }))
              }}
            >
              {draft.emoji}
            </button>
            <div className="min-w-0">
              {editingName ? (
                <input
                  autoFocus
                  className="bg-gray-800 border border-blue-600 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none w-full max-w-xs"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName()
                    if (e.key === 'Escape') {
                      setEditingName(false)
                      setNameDraft(draft.name)
                    }
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingName(true)
                    setNameDraft(draft.name)
                  }}
                  className="flex items-center gap-1.5 group/name"
                  title="Click to rename"
                >
                  <span className="text-sm font-semibold text-white group-hover/name:text-blue-400 transition-colors">
                    {draft.name}
                  </span>
                  <Pencil
                    size={11}
                    className="text-gray-700 group-hover/name:text-blue-400 opacity-0 group-hover/name:opacity-100 transition-all"
                  />
                </button>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                    meta.badgeClass,
                  )}
                >
                  <Icon size={10} />
                  {meta.label}
                </span>
                <select
                  value={draft.type}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, type: e.target.value as WorkspaceType }))
                  }
                  className="bg-transparent text-[10px] text-gray-600 focus:outline-none cursor-pointer hover:text-gray-400"
                >
                  {(Object.keys(TYPE_META) as WorkspaceType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap size={12} className={draft.active ? 'text-yellow-400' : 'text-gray-700'} />
              <span className="text-xs text-gray-500">Inject into chat</span>
              <Switch
                checked={draft.active}
                onChange={(v) => setDraft((p) => ({ ...p, active: v }))}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <input
          className="mt-3 w-full bg-transparent text-xs text-gray-500 placeholder-gray-700 focus:outline-none hover:text-gray-400 focus:text-gray-300 transition-colors"
          value={draft.description}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          placeholder="Add a description..."
        />
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-700 font-semibold">
            Fields
          </span>
          <span className="text-[10px] text-gray-700">
            {draft.fields.length} field{draft.fields.length !== 1 ? 's' : ''}
          </span>
        </div>

        {draft.fields.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-gray-700">No fields yet. Add your first field below.</p>
          </div>
        ) : (
          <div>
            {draft.fields.map((field, i) => (
              <FieldRow
                key={field.id}
                field={field}
                onChange={(f) => updateField(i, f)}
                onDelete={() => deleteField(i)}
              />
            ))}
          </div>
        )}

        <button
          onClick={addField}
          className="mt-3 flex items-center gap-2 text-xs text-gray-600 hover:text-gray-300 transition-colors py-1 group"
        >
          <Plus size={13} className="group-hover:text-blue-400" />
          Add field
        </button>

        {/* Documents */}
        <div className="mt-5 pt-4 border-t border-gray-800/40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-gray-700 font-semibold">
                Documents
              </span>
              <p className="text-[10px] text-gray-700 mt-0.5">
                Markdown files, READMEs, notes — indexed for semantic search
              </p>
            </div>
            <span className="text-[10px] text-gray-700">{draft.documents.length}</span>
          </div>
          {draft.documents.map((doc, i) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onChange={(d) => updateDoc(i, d)}
              onDelete={() => deleteDoc(i)}
            />
          ))}
          <button
            onClick={addDoc}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-300 transition-colors py-1 group"
          >
            <Plus size={13} className="group-hover:text-blue-400" />
            Add document
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800/60 flex items-center justify-between">
        <button
          onClick={() => {
            if (confirm(`Delete "${draft.name}"?`)) onDelete()
          }}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
          Delete workspace
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check size={12} />
              Saved
            </span>
          )}
          <Button
            variant={dirty ? 'default' : 'outline'}
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Workspace List Item ──────────────────────────────────────────────────────

interface WorkspaceCardProps {
  workspace: Workspace
  active: boolean
  onClick: () => void
}

function WorkspaceCard({ workspace, active, onClick }: WorkspaceCardProps) {
  const meta = TYPE_META[workspace.type]
  const Icon = meta.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-l-2',
        active
          ? 'bg-gray-800/80 border-blue-500'
          : 'border-transparent hover:bg-gray-800/40 hover:border-gray-700',
      )}
    >
      <div className="text-lg leading-none flex-shrink-0">{workspace.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{workspace.name}</span>
          {workspace.active && (
            <span title="Active — injected into chat">
              <Zap size={10} className="text-yellow-400 flex-shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Icon size={10} className={cn('flex-shrink-0', meta.color)} />
          <span className="text-[10px] text-gray-600 truncate">{meta.label}</span>
          <span className="text-[10px] text-gray-700">·</span>
          <span className="text-[10px] text-gray-700">{workspace.fields.length}f</span>
          {workspace.documents.length > 0 && (
            <>
              <span className="text-[10px] text-gray-700">·</span>
              <span className="text-[10px] text-gray-700">{workspace.documents.length}d</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspacesFetched, setWorkspacesFetched] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/workspaces')
    const data = (await res.json()) as { workspaces: Workspace[] }
    setWorkspaces(data.workspaces ?? [])
    setWorkspacesFetched(true)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedWs = workspaces.find((w) => w.id === selected) ?? null

  async function handlePick(type: WorkspaceType) {
    if (creating) return
    setCreating(true)
    const tmpl = TEMPLATES[type]
    const meta = TYPE_META[type]
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `New ${meta.label}`,
          type,
          emoji: tmpl.emoji,
          description: '',
          fields: tmpl.fields.map((f, i) => ({ ...f, id: `f-${Date.now()}-${i}` })),
          documents: [],
          active: false,
        }),
      })
      const data = (await res.json()) as { workspace: Workspace }
      setWorkspaces((prev) => [data.workspace, ...prev])
      setSelected(data.workspace.id)
      setShowPicker(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleSave(ws: Workspace) {
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${ws.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ws),
      })
      const data = (await res.json()) as { workspace: Workspace }
      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? data.workspace : w)))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    await fetch(`/api/workspaces/${selected}`, { method: 'DELETE' })
    setWorkspaces((prev) => prev.filter((w) => w.id !== selected))
    setSelected(null)
  }

  const activeCount = workspaces.filter((w) => w.active).length

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Left panel — workspace list */}
      <div className="w-64 flex-shrink-0 border-r border-gray-800/60 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-800/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-sm font-semibold text-white">Workspaces</h1>
              {activeCount > 0 && (
                <p className="text-[10px] text-yellow-500 mt-0.5">
                  <Zap size={9} className="inline mr-0.5" />
                  {activeCount} active in chat
                </p>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowPicker(true)}
              className="gap-1"
            >
              <Plus size={13} />
              New
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {!workspacesFetched ? (
            <div className="space-y-1 px-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : workspaces.length === 0 && !showPicker ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-gray-700">No workspaces yet</p>
            </div>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                active={selected === ws.id}
                onClick={() => {
                  setSelected(ws.id)
                  setShowPicker(false)
                }}
              />
            ))
          )}
        </div>

        {/* Active badge count */}
        {activeCount > 0 && (
          <div className="px-4 py-3 border-t border-gray-800/60">
            <div className="flex items-center gap-2">
              <Zap size={11} className="text-yellow-500" />
              <span className="text-[10px] text-gray-500">
                {activeCount} workspace{activeCount !== 1 ? 's' : ''} injected into LLM chat
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden">
        {showPicker ? (
          <div className="h-full overflow-y-auto max-w-lg">
            <TemplatePicker onPick={(t) => void handlePick(t)} loading={creating} />
          </div>
        ) : selectedWs ? (
          <WorkspaceEditor
            key={selectedWs.id}
            workspace={selectedWs}
            onSave={(ws) => handleSave(ws)}
            onDelete={() => void handleDelete()}
            saving={saving}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={<Briefcase size={28} />}
              title="Select or create a workspace"
              description="Workspaces store project, client, and personal context that gets injected directly into your LLM chat sessions."
              action={
                <Button variant="default" size="sm" onClick={() => setShowPicker(true)}>
                  <Plus size={13} />
                  New Workspace
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
