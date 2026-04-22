'use client'
import { useState, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface LLMStatus {
  provider: string
  model: string
  ready: boolean
  error?: string
  availableModels?: string[]
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null)

  useEffect(() => {
    fetch('/api/llm-status')
      .then((r) => r.json())
      .then((data: LLMStatus) => setLLMStatus(data))
      .catch(() =>
        setLLMStatus({
          provider: 'unknown',
          model: '',
          ready: false,
          error: 'Could not check LLM status',
        }),
      )
  }, [])

  async function handleSend() {
    if (!input.trim()) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      })
      const data = (await res.json()) as { content?: string; error?: string }
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content ?? data.error ?? 'No response',
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          content: 'Error: failed to reach the server',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-col h-screen p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-3 text-white">Chat</h1>

      {/* LLM status banner */}
      {llmStatus && !llmStatus.ready && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-sm">
          <div className="font-semibold mb-1">LLM not ready</div>
          <div className="text-yellow-400/80">{llmStatus.error}</div>
          {llmStatus.availableModels && llmStatus.availableModels.length > 0 && (
            <div className="mt-1 text-xs text-yellow-500">
              Available models: {llmStatus.availableModels.join(', ')}
            </div>
          )}
          <div className="mt-2 text-xs text-yellow-500">
            Set <code className="bg-yellow-900/60 px-1 rounded">ANTHROPIC_API_KEY</code> in{' '}
            <code className="bg-yellow-900/60 px-1 rounded">.env</code> or run{' '}
            <code className="bg-yellow-900/60 px-1 rounded">ollama serve</code> locally.
          </div>
        </div>
      )}

      {llmStatus?.ready && (
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {llmStatus.provider} · {llmStatus.model}
        </div>
      )}

      {messages.length === 0 && (
        <div className="text-gray-600 text-sm mt-4 text-center">Send a message to start</div>
      )}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4" data-testid="message-list">
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`message-${msg.role}`}
            className={`p-3 rounded-lg max-w-lg text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-auto'
                : 'bg-gray-800 text-gray-100 mr-auto'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div data-testid="loading-indicator" className="text-gray-500 text-sm">
            Thinking…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          data-testid="chat-input"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
          placeholder="Type a message…"
          disabled={isLoading}
        />
        <button
          data-testid="send-button"
          onClick={() => void handleSend()}
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 text-sm font-medium"
        >
          Send
        </button>
      </div>
    </main>
  )
}
