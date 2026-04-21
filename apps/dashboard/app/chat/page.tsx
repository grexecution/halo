'use client'
import { useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
      const data = (await res.json()) as { content: string }
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: 'err', role: 'assistant', content: 'Error: failed to get response' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-col h-screen p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat</h1>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4" data-testid="message-list">
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`message-${msg.role}`}
            className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 ml-auto max-w-md' : 'bg-gray-100 mr-auto max-w-md'}`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div data-testid="loading-indicator" className="text-gray-400">
            Thinking…
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          data-testid="chat-input"
          className="flex-1 border rounded-lg px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message…"
          disabled={isLoading}
        />
        <button
          data-testid="send-button"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </main>
  )
}
