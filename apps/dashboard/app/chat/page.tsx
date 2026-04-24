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
} from 'lucide-react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from '@assistant-ui/react'
import { Thread } from '@/app/components/assistant-ui/thread'
import { ChatSidebarSkeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/cn'

// ─── Session types ─────────────────────────────────────────────────────────

interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

// ─── Date grouping ─────────────────────────────────────────────────────────

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

// ─── SSE adapter — bridges LocalRuntime ↔ /api/chats/[id]/messages ─────────

function makeAdapter(
  sessionIdRef: React.MutableRefObject<string | null>,
  onNewSession: (id: string, title: string) => void,
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
          body: JSON.stringify({ title: userText.slice(0, 60) || 'New chat' }),
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
        body: JSON.stringify({ message: userText }),
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
            } catch {
              // skip malformed events
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (text) yield { content: [{ type: 'text' as const, text }] }
    },
  }
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

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

  // Group by date
  const grouped = new Map<string, ChatSession[]>()
  for (const s of filtered) {
    const group = getDateGroup(s.updatedAt || s.createdAt)
    const list = grouped.get(group) ?? []
    list.push(s)
    grouped.set(group, list)
  }

  if (collapsed) {
    return (
      <aside className="flex flex-col h-full border-r border-gray-800 bg-gray-950 w-12 shrink-0">
        <div className="flex flex-col items-center py-3 gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={onNew}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="New chat"
          >
            <Plus size={14} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex flex-col h-full border-r border-gray-800 bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600">
            <SparklesIcon size={10} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-300">Greg</span>
          <span className="sr-only">Chats</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="New chat"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-gray-800/60">
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
          />
          <input
            type="search"
            placeholder="Search chats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
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
                <Search size={18} className="text-gray-700" />
                <p className="text-xs text-gray-600">No chats match &ldquo;{search}&rdquo;</p>
              </>
            ) : (
              <>
                <Bot size={22} className="text-gray-700" />
                <p className="text-xs text-gray-600">No conversations yet</p>
                <button
                  onClick={onNew}
                  className="mt-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Start one →
                </button>
              </>
            )}
          </div>
        ) : (
          GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => (
            <div key={group}>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
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
      <div className="px-3 py-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-700">
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
        'group flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors rounded-lg mx-1.5 my-0.5',
        activeId === s.id
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:bg-gray-900/80 hover:text-gray-200',
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
            className="flex-1 min-w-0 bg-gray-700 rounded px-2 py-0.5 text-xs text-white outline-none border border-gray-600 focus:border-blue-500"
          />
          <button
            onClick={() => onEditSave(s.id)}
            className="text-green-400 hover:text-green-300 p-0.5"
          >
            <Check size={11} />
          </button>
          <button onClick={onEditCancel} className="text-gray-500 hover:text-gray-300 p-0.5">
            <X size={11} />
          </button>
        </div>
      ) : (
        <>
          <MessageSquare size={11} className="shrink-0 text-gray-600 group-hover:text-gray-500" />
          <span className="flex-1 min-w-0 text-xs truncate">{s.title || 'Untitled'}</span>
          {s.messageCount > 0 && (
            <span className="shrink-0 text-[10px] text-gray-700 group-hover:hidden">
              {s.messageCount}
            </span>
          )}
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditStart(s.id, s.title)
              }}
              className="p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-gray-300 transition-colors"
            >
              <PenLine size={10} />
            </button>
            <button
              onClick={(e) => onDelete(s.id, e)}
              className="p-1 rounded hover:bg-gray-700 text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Delete confirm modal ──────────────────────────────────────────────────

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
        className="bg-gray-900 border border-gray-700/80 rounded-2xl p-5 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-1">Delete conversation?</h3>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Remove it from the list while keeping it in the database for learning, or also purge any
          memories extracted from this conversation.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(false)}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs text-white transition-colors"
          >
            <span className="font-medium">Remove from list</span>
            <p className="text-gray-400 mt-0.5">Keeps messages + memories in DB for learning</p>
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/40 text-xs text-white transition-colors"
          >
            <span className="font-medium text-red-300">Remove + purge memory</span>
            <p className="text-red-400/70 mt-0.5">
              Also deletes memories tied to this conversation
            </p>
          </button>
          <button
            onClick={onCancel}
            className="w-full px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsFetched, setSessionsFetched] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Ref so the adapter closure can read/write current session id without stale closure
  const sessionIdRef = useRef<string | null>(activeSessionId)
  useEffect(() => {
    sessionIdRef.current = activeSessionId
  }, [activeSessionId])

  // ── Fetch sessions ──────────────────────────────────────────────────────
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

  // ── Session selection ───────────────────────────────────────────────────
  function selectSession(id: string) {
    setActiveSessionId(id)
    sessionIdRef.current = id
  }

  function newSession() {
    setActiveSessionId(null)
    sessionIdRef.current = null
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

  // ── Delete ──────────────────────────────────────────────────────────────
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

  // ── Edit title ──────────────────────────────────────────────────────────
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

  // ── Runtime — stable ────────────────────────────────────────────────────
  const adapter = useMemo(() => makeAdapter(sessionIdRef, handleNewSession), []) // stable
  const runtime = useLocalRuntime(adapter)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
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
            onSelect={selectSession}
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
          <Thread />
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <DeleteModal
          onConfirm={(purge) => void confirmDelete(purge)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </AssistantRuntimeProvider>
  )
}
