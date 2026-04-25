'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  Trash2,
  MessageSquare,
  Bot,
  PenLine,
  Check,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  SparklesIcon,
  ChevronDown,
  Cpu,
  User,
} from 'lucide-react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { Thread } from '@/app/components/assistant-ui/thread'
import { ChatSidebarSkeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/cn'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface HistoryMessage {
  id: string
  role: string
  content: string
  timestamp: string
}

interface Agent {
  handle: string
  name: string
  model: string
  modelName?: string
}

// ─── Date grouping ──────────────────────────────────────────────────────────

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This week'
  if (diffDays < 30) return 'This month'
  return 'Older'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Older']

// ─── Strip JSON wrapper from Llama tool-use responses ───────────────────────
// Llama 3.2 sometimes wraps plain answers in {"message":"..."}
function unwrapLlamaJson(text: string): string {
  const t = text.trim()
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const obj = JSON.parse(t) as Record<string, unknown>
      if (typeof obj['message'] === 'string') return obj['message'] as string
      if (typeof obj['response'] === 'string') return obj['response'] as string
      if (typeof obj['content'] === 'string') return obj['content'] as string
      if (typeof obj['text'] === 'string') return obj['text'] as string
    } catch {
      // not JSON, keep as-is
    }
  }
  return text
}

// ─── SSE adapter ────────────────────────────────────────────────────────────

function makeAdapter(
  sessionIdRef: React.MutableRefObject<string | null>,
  onNewSession: (id: string, title: string) => void,
  onSessionUpdated: (id: string) => void,
  agentRef: React.MutableRefObject<string>,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }): AsyncGenerator<ChatModelRunResult, void> {
      const lastMsg = messages.at(-1)
      if (!lastMsg || lastMsg.role !== 'user') return

      const userText = lastMsg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')

      // Auto-create session on first message
      if (!sessionIdRef.current) {
        const res = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: userText.slice(0, 60) || 'New chat',
            agentId: agentRef.current,
          }),
          signal: abortSignal,
        })
        if (!res.ok) throw new Error('Failed to create chat')
        const data = (await res.json()) as { id: string; title: string }
        sessionIdRef.current = data.id
        onNewSession(data.id, data.title)
      }

      const chatId = sessionIdRef.current!

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, agentId: agentRef.current }),
        signal: abortSignal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let text = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue
            try {
              const evt = JSON.parse(raw) as {
                type: string
                text?: string
                name?: string
                args?: unknown
                message?: string
              }
              if (evt.type === 'chunk' && evt.text) {
                text += evt.text
                yield { content: [{ type: 'text' as const, text }] }
              } else if (evt.type === 'done') {
                // unwrap JSON wrapper if present
                const clean = unwrapLlamaJson(text)
                if (clean !== text) {
                  text = clean
                  yield { content: [{ type: 'text' as const, text }] }
                }
                onSessionUpdated(chatId)
              } else if (evt.type === 'tool') {
                const toolArgsJson = JSON.stringify(evt.args ?? {})
                yield {
                  content: [
                    { type: 'text' as const, text },
                    {
                      type: 'tool-call' as const,
                      toolCallId: `tool-${Date.now()}`,
                      toolName: String(evt.name ?? 'tool'),
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      args: (evt.args ?? {}) as any,
                      argsText: toolArgsJson,
                    },
                  ],
                }
              } else if (evt.type === 'error') {
                throw new Error(evt.message ?? 'Agent error')
              }
            } catch (parseErr) {
              // skip malformed events (but rethrow real errors)
              if (parseErr instanceof Error && parseErr.message !== 'Agent error') {
                // parse error from JSON.parse — skip
              } else {
                throw parseErr
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // Final yield with cleaned text
      const finalText = unwrapLlamaJson(text)
      if (finalText) yield { content: [{ type: 'text' as const, text: finalText }] }
    },
  }
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  sessions: ChatSession[]
  sessionsFetched: boolean
  activeId: string | null
  collapsed: boolean
  onToggleCollapse: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string, e: React.MouseEvent) => void
  editingId: string | null
  editTitle: string
  onEditStart: (id: string, title: string) => void
  onEditSave: (id: string) => void
  onEditCancel: () => void
  onEditChange: (v: string) => void
}

function Sidebar({
  sessions,
  sessionsFetched,
  activeId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onNew,
  onDelete,
  editingId,
  editTitle,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditChange,
}: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions

  const grouped = new Map<string, ChatSession[]>()
  for (const s of filtered) {
    const group = getDateGroup(s.updatedAt || s.createdAt)
    const list = grouped.get(group) ?? []
    list.push(s)
    grouped.set(group, list)
  }

  if (collapsed) {
    return (
      <aside className="flex flex-col h-full border-r border-border bg-sidebar-bg w-12 shrink-0">
        <div className="flex flex-col items-center py-3 gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-sidebar-item-hover text-sidebar-text hover:text-sidebar-text-active transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={onNew}
            className="p-1.5 rounded-md hover:bg-sidebar-item-hover text-sidebar-text hover:text-sidebar-text-active transition-colors"
            aria-label="New chat"
          >
            <Plus size={14} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex flex-col h-full border-r border-border bg-sidebar-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600">
            <SparklesIcon size={10} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-sidebar-text-active">Chats</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="p-1 rounded-md hover:bg-sidebar-item-hover text-sidebar-text hover:text-sidebar-text-active transition-colors"
            aria-label="New chat"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-sidebar-item-hover text-sidebar-text hover:text-sidebar-text-active transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-border/60">
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search chats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/40 border border-border/60 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {!sessionsFetched ? (
          <ChatSidebarSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 px-4 text-center">
            {search ? (
              <>
                <Search size={18} className="text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  No chats match &ldquo;{search}&rdquo;
                </p>
              </>
            ) : (
              <>
                <Bot size={22} className="text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No conversations yet</p>
                <button
                  onClick={onNew}
                  className="mt-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Start one →
                </button>
              </>
            )}
          </div>
        ) : (
          GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => (
            <div key={group}>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                {group}
              </p>
              {grouped.get(group)!.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  activeId={activeId}
                  editingId={editingId}
                  editTitle={editTitle}
                  inputRef={inputRef}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onEditStart={onEditStart}
                  onEditSave={onEditSave}
                  onEditCancel={onEditCancel}
                  onEditChange={onEditChange}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground/50">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>
    </aside>
  )
}

function SessionRow({
  session: s,
  activeId,
  editingId,
  editTitle,
  inputRef,
  onSelect,
  onDelete,
  onEditStart,
  onEditSave,
  onEditCancel,
  onEditChange,
}: {
  session: ChatSession
  activeId: string | null
  editingId: string | null
  editTitle: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onEditStart: (id: string, title: string) => void
  onEditSave: (id: string) => void
  onEditCancel: () => void
  onEditChange: (v: string) => void
}) {
  return (
    <div
      onClick={() => onSelect(s.id)}
      className={cn(
        'group flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-all rounded-lg mx-1.5 my-0.5',
        activeId === s.id
          ? 'bg-sidebar-item-active text-sidebar-text-active border-l-2 border-primary'
          : 'text-sidebar-text hover:bg-sidebar-item-hover hover:text-sidebar-text-active',
      )}
    >
      {editingId === s.id ? (
        <div
          className="flex-1 flex items-center gap-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave(s.id)
              if (e.key === 'Escape') onEditCancel()
            }}
            className="flex-1 min-w-0 bg-muted rounded px-2 py-0.5 text-xs text-foreground outline-none border border-border focus:border-primary/60"
          />
          <button
            onClick={() => onEditSave(s.id)}
            className="text-green-500 hover:text-green-400 p-0.5"
          >
            <Check size={11} />
          </button>
          <button
            onClick={onEditCancel}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <>
          <MessageSquare
            size={11}
            className="shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground"
          />
          <span className="flex-1 min-w-0 text-xs truncate">{s.title || 'Untitled'}</span>
          {s.messageCount > 0 && (
            <span className="shrink-0 text-[10px] text-muted-foreground/50 group-hover:hidden">
              {s.messageCount}
            </span>
          )}
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditStart(s.id, s.title)
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <PenLine size={10} />
            </button>
            <button
              onClick={(e) => onDelete(s.id, e)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (purge: boolean) => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-border rounded-2xl p-5 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground mb-1">Delete conversation?</h3>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Remove it from the list while keeping it in the database for learning, or also purge any
          memories extracted from this conversation.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(false)}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-xs text-foreground transition-colors"
          >
            <span className="font-medium">Remove from list</span>
            <p className="text-muted-foreground mt-0.5">
              Keeps messages + memories in DB for learning
            </p>
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-xs text-foreground transition-colors"
          >
            <span className="font-medium text-destructive">Remove + purge memory</span>
            <p className="text-destructive/70 mt-0.5">
              Also deletes memories tied to this conversation
            </p>
          </button>
          <button
            onClick={onCancel}
            className="w-full px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Agent / model picker ─────────────────────────────────────────────────────

interface AgentPickerProps {
  agents: Agent[]
  selectedAgent: string
  onSelect: (handle: string) => void
}

function AgentPicker({ agents, selectedAgent, onSelect }: AgentPickerProps) {
  const [open, setOpen] = useState(false)
  const current = agents.find((a) => a.handle === selectedAgent) ?? agents[0]
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!current) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 border border-border/60 text-[11px] text-foreground font-medium transition-colors"
      >
        <User size={10} className="text-primary" />
        <span className="max-w-[100px] truncate">{current.name}</span>
        <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">
          · {current.modelName ?? current.model}
        </span>
        <ChevronDown size={9} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-52 rounded-xl bg-card border border-border shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Agent
            </p>
          </div>
          {agents.map((a) => (
            <button
              key={a.handle}
              type="button"
              onClick={() => {
                onSelect(a.handle)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors',
                a.handle === selectedAgent && 'bg-muted/60',
              )}
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 mt-0.5">
                <SparklesIcon size={10} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Cpu size={8} />
                  <span className="truncate">{a.modelName ?? a.model}</span>
                </p>
              </div>
              {a.handle === selectedAgent && (
                <Check size={12} className="shrink-0 text-primary mt-1 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsFetched, setSessionsFetched] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('greg')
  // history for loading past sessions into the runtime
  const [initialMessages, setInitialMessages] = useState<ThreadMessageLike[]>([])
  const [threadKey, setThreadKey] = useState(0) // bump to reset runtime

  const sessionIdRef = useRef<string | null>(activeSessionId)
  const agentRef = useRef<string>(selectedAgent)

  useEffect(() => {
    sessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    agentRef.current = selectedAgent
  }, [selectedAgent])

  // ── Fetch sessions ───────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chats')
      if (res.ok) {
        const data = (await res.json()) as ChatSession[]
        setSessions(data)
      }
    } finally {
      setSessionsFetched(true)
    }
  }, [])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  // ── Fetch agents ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { agents?: Agent[] } | Agent[]
        const agentList = Array.isArray(d) ? d : ((d as { agents?: Agent[] }).agents ?? [])
        if (agentList.length > 0) {
          setAgents(agentList)
          setSelectedAgent(agentList[0]!.handle)
        }
      })
      .catch(() => {
        // fallback: use default greg agent
        setAgents([{ handle: 'greg', name: 'Greg', model: 'llama3.2', modelName: 'llama3.2' }])
      })
  }, [])

  // ── Load past session into runtime ───────────────────────────────────────
  const loadSession = useCallback(async (id: string) => {
    setActiveSessionId(id)
    sessionIdRef.current = id

    try {
      const res = await fetch(`/api/chats/${id}`)
      if (!res.ok) return
      const data = (await res.json()) as { messages: HistoryMessage[] }
      const msgs: ThreadMessageLike[] = data.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text' as const, text: unwrapLlamaJson(m.content) }],
        id: m.id,
      }))
      setInitialMessages(msgs)
      setThreadKey((k) => k + 1) // reset runtime with history
    } catch {
      setInitialMessages([])
      setThreadKey((k) => k + 1)
    }
  }, [])

  // ── New session ──────────────────────────────────────────────────────────
  function newSession() {
    setActiveSessionId(null)
    sessionIdRef.current = null
    setInitialMessages([])
    setThreadKey((k) => k + 1)
  }

  function handleNewSession(id: string, title: string) {
    const newS: ChatSession = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 1,
    }
    setSessions((prev) => [newS, ...prev])
    setActiveSessionId(id)
    sessionIdRef.current = id
  }

  function handleSessionUpdated(id: string) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, updatedAt: new Date().toISOString(), messageCount: s.messageCount + 1 }
          : s,
      ),
    )
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function requestDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeleteConfirm(id)
  }

  async function confirmDelete(purge: boolean) {
    if (!deleteConfirm) return
    const id = deleteConfirm
    setDeleteConfirm(null)
    try {
      await fetch(`/api/chats/${id}?purge=${purge}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) newSession()
    } catch {
      // silently fail
    }
  }

  // ── Edit title ───────────────────────────────────────────────────────────
  async function saveTitle(id: string) {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    try {
      await fetch(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      })
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: editTitle.trim() } : s)))
    } finally {
      setEditingId(null)
    }
  }

  // ── Runtime ──────────────────────────────────────────────────────────────
  const adapter = useMemo(
    () => makeAdapter(sessionIdRef, handleNewSession, handleSessionUpdated, agentRef),
    [], // refs are stable, handlers are stable closures — safe to omit
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          'shrink-0 flex flex-col transition-all duration-200',
          sidebarCollapsed ? 'w-12' : 'w-56',
        )}
      >
        <Sidebar
          sessions={sessions}
          sessionsFetched={sessionsFetched}
          activeId={activeSessionId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onSelect={loadSession}
          onNew={newSession}
          onDelete={requestDelete}
          editingId={editingId}
          editTitle={editTitle}
          onEditStart={(id, title) => {
            setEditingId(id)
            setEditTitle(title)
          }}
          onEditSave={saveTitle}
          onEditCancel={() => setEditingId(null)}
          onEditChange={setEditTitle}
        />
      </div>

      {/* Thread area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <RuntimeWrapper
          key={threadKey}
          adapter={adapter}
          initialMessages={initialMessages}
          agents={agents}
          selectedAgent={selectedAgent}
          onAgentSelect={setSelectedAgent}
        />
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <DeleteModal
          onConfirm={(purge) => void confirmDelete(purge)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

// ─── RuntimeWrapper — isolated so key reset works ────────────────────────────

function RuntimeWrapper({
  adapter,
  initialMessages,
  agents,
  selectedAgent,
  onAgentSelect,
}: {
  adapter: ChatModelAdapter
  initialMessages: ThreadMessageLike[]
  agents: Agent[]
  selectedAgent: string
  onAgentSelect: (handle: string) => void
}) {
  const runtime = useLocalRuntime(adapter, {
    initialMessages,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        agentPicker={
          <AgentPicker agents={agents} selectedAgent={selectedAgent} onSelect={onAgentSelect} />
        }
      />
    </AssistantRuntimeProvider>
  )
}
