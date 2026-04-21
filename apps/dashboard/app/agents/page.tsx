'use client'
import { useState } from 'react'

interface Agent {
  id: string
  handle: string
  name: string
  model: string
  systemPrompt: string
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      handle: 'claw',
      name: 'Claw',
      model: 'claude-opus-4-7',
      systemPrompt: 'You are Claw, a generalist AI assistant.',
    },
  ])
  const [editing, setEditing] = useState<Agent | null>(null)
  const [form, setForm] = useState({
    handle: '',
    name: '',
    model: 'claude-opus-4-7',
    systemPrompt: '',
  })

  function handleNew() {
    setEditing(null)
    setForm({ handle: '', name: '', model: 'claude-opus-4-7', systemPrompt: '' })
  }

  function handleEdit(agent: Agent) {
    setEditing(agent)
    setForm({
      handle: agent.handle,
      name: agent.name,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
    })
  }

  function handleSave() {
    if (!form.handle.trim() || !form.name.trim()) return
    if (editing) {
      setAgents((prev) => prev.map((a) => (a.id === editing.id ? { ...editing, ...form } : a)))
    } else {
      setAgents((prev) => [...prev, { id: Date.now().toString(), ...form }])
    }
    setEditing(null)
    setForm({ handle: '', name: '', model: 'claude-opus-4-7', systemPrompt: '' })
  }

  function handleDelete(id: string) {
    setAgents((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Agents</h1>
        <button
          data-testid="new-agent-button"
          onClick={handleNew}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          New Agent
        </button>
      </div>

      <ul data-testid="agent-list" className="space-y-2 mb-6">
        {agents.map((agent) => (
          <li
            key={agent.id}
            data-testid={`agent-item-${agent.handle}`}
            className="border rounded p-3 flex justify-between"
          >
            <div>
              <span className="font-mono font-bold">@{agent.handle}</span>
              <span className="ml-2 text-gray-600">{agent.name}</span>
              <span className="ml-2 text-xs text-gray-400">{agent.model}</span>
            </div>
            <div className="flex gap-2">
              <button
                data-testid={`edit-${agent.handle}`}
                onClick={() => handleEdit(agent)}
                className="text-blue-500"
              >
                Edit
              </button>
              <button
                data-testid={`delete-${agent.handle}`}
                onClick={() => handleDelete(agent.id)}
                className="text-red-500"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div data-testid="agent-form" className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">{editing ? 'Edit Agent' : 'New Agent'}</h2>
        <input
          data-testid="handle-input"
          className="w-full border rounded px-2 py-1"
          placeholder="handle (no spaces)"
          value={form.handle}
          onChange={(e) => setForm((prev) => ({ ...prev, handle: e.target.value }))}
        />
        <input
          data-testid="name-input"
          className="w-full border rounded px-2 py-1"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <textarea
          data-testid="system-prompt-input"
          className="w-full border rounded px-2 py-1"
          placeholder="System prompt"
          value={form.systemPrompt}
          onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
          rows={3}
        />
        <button
          data-testid="save-agent-button"
          onClick={handleSave}
          disabled={!form.handle.trim() || !form.name.trim()}
          className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </main>
  )
}
