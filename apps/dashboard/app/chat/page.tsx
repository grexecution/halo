'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, MessageSquare, Send, ChevronDown, Zap } from 'lucide-react'
import { Button, EmptyState, cn } from '../components/ui/index'

interface ActiveWorkspace {
  id: string
  name: string
  emoji: string
}

interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Model {
  id: string
  name: string
  provider: string
  available: boolean
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const [activeWorkspaces, setActiveWorkspaces] = useState<ActiveWorkspace[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    void fetchSessions()
    void fetchModels()
    void fetchActiveWorkspaces()
  }, [])

  async function fetchActiveWorkspaces() {
    try {
      const res = await fetch('/api/workspaces')
      const data = (await res.json()) as {
        workspaces: Array<{ id: string; name: string; emoji: string; active: boolean }>
      }
      setActiveWorkspaces((data.workspaces ?? []).filter((w) => w.active))
    } catch {
      setActiveWorkspaces([])
    }
  }

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  async function fetchSessions() {
    try {
      const res = await fetch('/api/chats')
      const data = (await res.json()) as { sessions: ChatSession[] }
      setSessions(data.sessions ?? [])
    } catch {
      setSessions([])
    }
  }

  async function fetchModels() {
    try {
      const res = await fetch('/api/models')
      const data = (await res.json()) as { models: Model[] }
      const list = data.models ?? []
      setModels(list)
      const first = list.find((m) => m.available) ?? list[0]
      if (first) setSelectedModel(first.id)
    } catch {
      setModels([])
    }
  }

  async function fetchSessionMessages(id: string) {
    try {
      const res = await fetch(`/api/chats/${id}`)
      const data = (await res.json()) as { id: string; title: string; messages: Message[] }
      setMessages(data.messages ?? [])
    } catch {
      setMessages([])
    }
  }

  async function createNewChat() {
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = (await res.json()) as ChatSession
      setSessions((prev) => [session, ...prev])
      setActiveSessionId(session.id)
      setMessages([])
      setTimeout(() => inputRef.current?.focus(), 50)
    } catch {
      // silently fail
    }
  }

  async function selectSession(id: string) {
    setActiveSessionId(id)
    setEditingTitle(false)
    await fetchSessionMessages(id)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await fetch(`/api/chats/${id}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        setActiveSessionId(null)
        setMessages([])
      }
    } catch {
      // silently fail
    }
  }

  async function handleSend() {
    if (!input.trim() || !activeSessionId || isLoading) return

    const userMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    const sentInput = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`/api/chats/${activeSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: sentInput, model: selectedModel || undefined }),
      })
      const data = (await res.json()) as { message: Message }
      setMessages((prev) => [...prev, data.message])
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date().toISOString() }
            : s,
        ),
      )
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Error: failed to reach the server.',
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function commitTitleEdit() {
    if (!activeSessionId || !titleDraft.trim()) {
      setEditingTitle(false)
      return
    }
    try {
      await fetch(`/api/chats/${activeSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleDraft.trim() }),
      })
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, title: titleDraft.trim() } : s)),
      )
    } catch {
      // silently fail
    }
    setEditingTitle(false)
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => void createNewChat()}
          >
            <Plus size={14} />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-gray-600">No conversations yet</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => void selectSession(session.id)}
                onMouseEnter={() => setHoveredSessionId(session.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
                className={cn(
                  'group relative flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                  activeSessionId === session.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200',
                )}
              >
                <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{session.title}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{session.messageCount} msgs</p>
                </div>
                {hoveredSessionId === session.id && (
                  <button
                    onClick={(e) => void deleteSession(session.id, e)}
                    className="flex-shrink-0 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors"
                    aria-label="Delete session"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
        {activeSession === null ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare size={32} />}
              title="Select or create a chat"
              description="Choose a conversation from the sidebar or start a new one."
              action={
                <Button variant="default" size="md" onClick={() => void createNewChat()}>
                  <Plus size={14} />
                  New Chat
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 gap-3">
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-full max-w-xs"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => void commitTitleEdit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitTitleEdit()
                      if (e.key === 'Escape') setEditingTitle(false)
                    }}
                  />
                ) : (
                  <button
                    className="text-sm font-medium text-white hover:text-blue-400 transition-colors truncate max-w-xs text-left"
                    onClick={() => {
                      setTitleDraft(activeSession.title)
                      setEditingTitle(true)
                    }}
                    title="Click to rename"
                  >
                    {activeSession.title}
                  </button>
                )}
              </div>

              {/* Active workspace chips */}
              {activeWorkspaces.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {activeWorkspaces.slice(0, 3).map((ws) => (
                    <a
                      key={ws.id}
                      href="/workspaces"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-yellow-900/30 text-yellow-400 border border-yellow-800/50 hover:bg-yellow-900/50 transition-colors"
                      title={`Workspace "${ws.name}" is injected into this chat`}
                    >
                      <Zap size={9} />
                      {ws.emoji} {ws.name}
                    </a>
                  ))}
                  {activeWorkspaces.length > 3 && (
                    <span className="text-[10px] text-gray-600">
                      +{activeWorkspaces.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Model selector */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <ChevronDown size={13} className="text-gray-600 -mr-1 pointer-events-none" />
                <select
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none pr-6"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ backgroundImage: 'none' }}
                >
                  {models.length === 0 && <option value="">No models available</option>}
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.provider} · {m.name}
                      {m.available ? '' : ' (unavailable)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="message-list">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-600">Send a message to start the conversation.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  data-testid={msg.role === 'user' ? 'message-user' : 'message-assistant'}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm max-w-[70%] leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white ml-auto'
                      : 'bg-gray-800 text-gray-100 mr-auto',
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div
                  data-testid="loading-indicator"
                  className="flex items-center gap-2 text-gray-500 text-sm"
                >
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:300ms]" />
                  </span>
                  <span className="text-xs">Thinking</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-gray-800">
              <div className="flex items-end gap-2">
                <input
                  ref={inputRef}
                  data-testid="chat-input"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none disabled:opacity-50"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={isLoading}
                />
                <Button
                  data-testid="send-button"
                  variant="default"
                  size="icon"
                  onClick={() => void handleSend()}
                  disabled={isLoading || !input.trim()}
                  aria-label="Send message"
                >
                  <Send size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
