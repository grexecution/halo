'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  User,
  Clock,
  Brain,
  FileText,
  Pin,
  PinOff,
  Trash2,
  Plus,
  Save,
  MessageSquare,
  Zap,
  Bot,
  Search,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  about: string
  preferences: string
  goals: string
  workContext: string
  updatedAt: string
}

interface Note {
  id: string
  title: string
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

interface TimelineEvent {
  id: string
  type: 'memory' | 'run' | 'chat'
  title: string
  body: string
  source: string
  ts: string
  meta: Record<string, unknown>
}

interface MemoryItem {
  id: string
  content: string
  source: string
  type: string
  createdAt?: string
  metadata?: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtRelative(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const EVENT_ICONS: Record<string, typeof MessageSquare> = {
  memory: Brain,
  run: Bot,
  chat: MessageSquare,
  goal: Zap,
}

const SOURCE_COLORS: Record<string, string> = {
  chat: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  email: 'bg-green-500/20 text-green-400 border-green-500/30',
  telegram: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  whatsapp: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  calendar: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  github: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  document: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  default: 'bg-muted/60 text-muted-foreground border-border',
}

function sourceStyle(source: string): string {
  return SOURCE_COLORS[source.toLowerCase()] ?? SOURCE_COLORS['default'] ?? ''
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────

function AvatarUpload() {
  const [avatarData, setAvatarData] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/you/avatar')
      .then((r) => r.json())
      .then((d: { avatarData?: string | null }) => setAvatarData(d.avatarData ?? null))
      .catch(() => {})
  }, [])

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setUploading(true)
      await fetch('/api/you/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarData: dataUrl }),
      }).catch(() => {})
      setAvatarData(dataUrl)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function removeAvatar() {
    setUploading(true)
    await fetch('/api/you/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarData: null }),
    }).catch(() => {})
    setAvatarData(null)
    setUploading(false)
  }

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border flex items-center justify-center flex-shrink-0 cursor-pointer group"
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {avatarData ? (
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${avatarData})` }}
            role="img"
            aria-label="Profile picture"
          />
        ) : (
          <User size={32} className="text-muted-foreground/50" />
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-[10px] font-medium">Change</span>
        </div>
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleChange}
      />
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Profile picture</p>
        <p className="text-xs text-muted-foreground">
          Click or drag an image. On mobile, you can take a photo.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Upload photo
          </button>
          {avatarData && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <button
                onClick={() => void removeAvatar()}
                className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileTab() {
  const [profile, setProfile] = useState<Profile>({
    about: '',
    preferences: '',
    goals: '',
    workContext: '',
    updatedAt: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/you/profile')
      .then((r) => r.json())
      .then((d: Profile) => setProfile(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/you/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        about: profile.about,
        preferences: profile.preferences,
        goals: profile.goals,
        workContext: profile.workContext,
      }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading)
    return (
      <div className="space-y-4">
        <div className="h-32 bg-card border border-border rounded-xl animate-pulse" />
        <div className="h-32 bg-card border border-border rounded-xl animate-pulse" />
      </div>
    )

  const sections = [
    {
      key: 'about' as const,
      label: 'About me',
      placeholder:
        'Tell Halo about yourself — your name, location, background, what you care about...',
    },
    {
      key: 'preferences' as const,
      label: 'My preferences',
      placeholder:
        'How do you like things done? Communication style, work hours, tools you prefer...',
    },
    {
      key: 'goals' as const,
      label: 'My goals',
      placeholder: 'What are you working towards? Short-term and long-term goals...',
    },
    {
      key: 'workContext' as const,
      label: 'Work context',
      placeholder: 'What do you work on? Projects, team, tech stack, role, company...',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="bg-card border border-border rounded-xl p-5">
        <AvatarUpload />
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This is what Halo knows about you. It uses this to personalise every response, task, and
          automation. The more you fill in, the better it works.
        </p>
      </div>

      {sections.map((s) => (
        <div key={s.key} className="bg-card border border-border rounded-xl p-5">
          <label className="block text-sm font-medium text-foreground mb-2">{s.label}</label>
          <Textarea
            value={profile[s.key]}
            onChange={(e) => setProfile((p) => ({ ...p, [s.key]: e.target.value }))}
            placeholder={s.placeholder}
            rows={4}
            className="resize-y"
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        {profile.updatedAt && (
          <span className="text-xs text-muted-foreground/60">
            Last updated {fmtDate(profile.updatedAt)}
          </span>
        )}
        <Button onClick={save} disabled={saving} className="ml-auto">
          <Save size={14} />
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Timeline ────────────────────────────────────────────────────────────

function TimelineTab() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const offset = useRef(0)
  const LIMIT = 30

  const load = useCallback(
    (reset = false) => {
      if (reset) {
        offset.current = 0
        setLoading(true)
      }
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset.current),
      })
      if (source) params.set('source', source)
      fetch(`/api/you/timeline?${params}`)
        .then((r) => r.json())
        .then((d: { events?: TimelineEvent[]; total?: number }) => {
          const evts = d.events ?? []
          setTotal(d.total ?? 0)
          if (reset || offset.current === 0) {
            setEvents(evts)
          } else {
            setEvents((prev) => [...prev, ...evts])
          }
          offset.current += evts.length
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    },
    [source],
  )

  useEffect(() => {
    load(true)
  }, [load])

  const SOURCES = ['memory', 'run', 'chat']

  return (
    <div className="space-y-4">
      {/* Source filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSource('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            source === ''
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              source === s
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'run' ? 'Agent runs' : s === 'memory' ? 'Memories' : 'Chats'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Clock size={32} />}
          title="No activity yet"
          description="Your chats, agent runs, and saved memories will appear here"
        />
      ) : (
        <>
          <div className="space-y-1.5">
            {events.map((ev) => {
              const Icon = EVENT_ICONS[ev.type] ?? MessageSquare
              return (
                <div
                  key={ev.id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <button
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={13} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {ev.title}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${sourceStyle(ev.source)}`}
                        >
                          {ev.source}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{ev.body}</p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground/60">
                        {fmtRelative(ev.ts)}
                      </span>
                      {expanded === ev.id ? (
                        <ChevronUp size={12} className="text-muted-foreground/60" />
                      ) : (
                        <ChevronDown size={12} className="text-muted-foreground/60" />
                      )}
                    </div>
                  </button>
                  {expanded === ev.id && (
                    <div className="border-t border-border px-4 py-3">
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed mb-2">
                        {ev.body}
                      </p>
                      <div className="text-xs text-muted-foreground/60">{fmtDate(ev.ts)}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {events.length < total && (
            <div className="text-center pt-2">
              <Button variant="outline" size="sm" onClick={() => load(false)}>
                Load more ({total - events.length} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Memory ──────────────────────────────────────────────────────────────

function MemoryTab() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50', offset: '0' })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    fetch(`/api/memories?${params}`)
      .then((r) => r.json())
      .then(
        (d: {
          results?: MemoryItem[]
          total?: number
          stats?: { bySource: Record<string, number> }
        }) => {
          setMemories(d.results ?? [])
          setTotal(d.total ?? 0)
        },
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query, source])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => setQuery(val), 300)
  }

  async function deleteMemory(id: string) {
    if (!window.confirm('Delete this memory?')) return
    await fetch(`/api/memories/${id}`, { method: 'DELETE' }).catch(() => {})
    setMemories((ms) => ms.filter((m) => m.id !== id))
    setTotal((t) => t - 1)
  }

  const sources = [...new Set(memories.map((m) => m.source).filter(Boolean))]

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search what Halo remembers…"
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Source filter */}
      {sources.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSource('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              source === ''
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All sources
          </button>
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s === source ? '' : s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                source === s
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="text-xs text-muted-foreground">
          {total.toLocaleString()} memories stored
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <EmptyState
          icon={<Brain size={32} />}
          title="No memories found"
          description={query ? 'Try a different search term' : 'Start chatting to build memories'}
        />
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${sourceStyle(m.source)}`}
                    >
                      {m.source || 'unknown'}
                    </span>
                    <Badge variant="muted" className="text-[10px]">
                      {m.type}
                    </Badge>
                    {m.createdAt && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {fmtRelative(m.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{m.content}</p>
                </div>
                <button
                  onClick={() => void deleteMemory(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────

function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  useEffect(() => {
    fetch('/api/you/notes')
      .then((r) => r.json())
      .then((d: { notes?: Note[] }) => setNotes(d.notes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function createNote() {
    if (!newContent.trim()) return
    const res = await fetch('/api/you/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle || 'Untitled', content: newContent }),
    })
    const d = (await res.json()) as { note?: Note }
    if (d.note) setNotes((ns) => [d.note!, ...ns])
    setNewTitle('')
    setNewContent('')
    setCreating(false)
  }

  async function saveEdit(id: string) {
    const res = await fetch('/api/you/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editTitle, content: editContent }),
    })
    const d = (await res.json()) as { note?: Note }
    if (d.note) setNotes((ns) => ns.map((n) => (n.id === id ? d.note! : n)))
    setEditing(null)
  }

  async function togglePin(note: Note) {
    const res = await fetch('/api/you/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: note.id,
        title: note.title,
        content: note.content,
        pinned: !note.pinned,
      }),
    })
    const d = (await res.json()) as { note?: Note }
    if (d.note) setNotes((ns) => ns.map((n) => (n.id === note.id ? d.note! : n)))
  }

  async function deleteNote(id: string) {
    if (!window.confirm('Delete this note?')) return
    await fetch(`/api/you/notes?id=${id}`, { method: 'DELETE' })
    setNotes((ns) => ns.filter((n) => n.id !== id))
  }

  const pinned = notes.filter((n) => n.pinned)
  const unpinned = notes.filter((n) => !n.pinned)

  return (
    <div className="space-y-4">
      {/* Create */}
      {creating ? (
        <div className="bg-card border border-primary/40 rounded-xl p-4 space-y-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title (optional)"
            className="text-sm"
          />
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write anything — context, reference info, lists, ideas..."
            rows={5}
            autoFocus
            className="resize-y"
          />
          <div className="flex gap-2">
            <Button onClick={() => void createNote()} disabled={!newContent.trim()}>
              <Save size={13} />
              Save note
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false)
                setNewTitle('')
                setNewContent('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setCreating(true)}>
          <Plus size={14} />
          New note
        </Button>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} />}
          title="No notes yet"
          description="Add context, reference info, or anything you want Halo to know"
        />
      ) : (
        <>
          {pinned.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1 mb-2">
                Pinned
              </p>
              <div className="space-y-2">
                {pinned.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    editing={editing === n.id}
                    editTitle={editTitle}
                    editContent={editContent}
                    onStartEdit={() => {
                      setEditing(n.id)
                      setEditTitle(n.title)
                      setEditContent(n.content)
                    }}
                    onSaveEdit={() => void saveEdit(n.id)}
                    onCancelEdit={() => setEditing(null)}
                    onEditTitle={setEditTitle}
                    onEditContent={setEditContent}
                    onTogglePin={() => void togglePin(n)}
                    onDelete={() => void deleteNote(n.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1 mb-2 mt-4">
                  Notes
                </p>
              )}
              <div className="space-y-2">
                {unpinned.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    editing={editing === n.id}
                    editTitle={editTitle}
                    editContent={editContent}
                    onStartEdit={() => {
                      setEditing(n.id)
                      setEditTitle(n.title)
                      setEditContent(n.content)
                    }}
                    onSaveEdit={() => void saveEdit(n.id)}
                    onCancelEdit={() => setEditing(null)}
                    onEditTitle={setEditTitle}
                    onEditContent={setEditContent}
                    onTogglePin={() => void togglePin(n)}
                    onDelete={() => void deleteNote(n.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface NoteCardProps {
  note: Note
  editing: boolean
  editTitle: string
  editContent: string
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditTitle: (v: string) => void
  onEditContent: (v: string) => void
  onTogglePin: () => void
  onDelete: () => void
}

function NoteCard({
  note,
  editing,
  editTitle,
  editContent,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTitle,
  onEditContent,
  onTogglePin,
  onDelete,
}: NoteCardProps) {
  if (editing) {
    return (
      <div className="bg-card border border-primary/40 rounded-xl p-4 space-y-3">
        <Input
          value={editTitle}
          onChange={(e) => onEditTitle(e.target.value)}
          placeholder="Title"
        />
        <Textarea
          value={editContent}
          onChange={(e) => onEditContent(e.target.value)}
          rows={5}
          autoFocus
          className="resize-y"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={onSaveEdit}>
            <Save size={12} />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 group">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          {note.pinned && <Pin size={11} className="text-primary flex-shrink-0" />}
          <h3 className="text-sm font-medium text-foreground">{note.title}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTogglePin}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            onClick={onStartEdit}
            className="p-1 rounded text-muted-foreground hover:text-foreground text-xs"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-muted-foreground hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {note.content}
      </p>
      <div className="text-[10px] text-muted-foreground/40 mt-2">{fmtRelative(note.updatedAt)}</div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'timeline' | 'memory' | 'notes'

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'notes', label: 'Notes', icon: FileText },
]

export default function YouPage() {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">You</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Everything Halo knows about you — your profile, history, and notes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'timeline' && <TimelineTab />}
      {tab === 'memory' && <MemoryTab />}
      {tab === 'notes' && <NotesTab />}
    </div>
  )
}
