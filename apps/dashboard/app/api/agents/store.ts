import { getDb } from '../../lib/db'

export interface AgentTools {
  shell: boolean
  browser: boolean
  filesystem: boolean
  gui: boolean
}

export interface Agent {
  handle: string
  name: string
  model: string
  fallbackModels: string[]
  systemPrompt: string
  tools: AgentTools
}

interface DbRow {
  handle: string
  name: string
  model: string
  fallback_models: string
  system_prompt: string
  tools: string
}

const DEFAULT_AGENTS: Agent[] = [
  {
    handle: 'main',
    name: 'Main Agent',
    model: 'claude-sonnet-4-6',
    fallbackModels: [],
    systemPrompt: 'You are a helpful AI assistant.',
    tools: { shell: false, browser: false, filesystem: false, gui: false },
  },
]

function toAgent(r: DbRow): Agent {
  return {
    handle: r.handle,
    name: r.name,
    model: r.model,
    fallbackModels: JSON.parse(r.fallback_models || '[]') as string[],
    systemPrompt: r.system_prompt,
    tools: JSON.parse(r.tools || '{}') as AgentTools,
  }
}

export function listAgents(): Agent[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all() as DbRow[]
  if (rows.length === 0) {
    for (const a of DEFAULT_AGENTS) upsertAgent(a)
    return DEFAULT_AGENTS
  }
  return rows.map(toAgent)
}

export function upsertAgent(agent: Agent): Agent {
  const db = getDb()
  db.prepare(
    `
    INSERT INTO agents (handle, name, model, fallback_models, system_prompt, tools, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(handle) DO UPDATE SET
      name = excluded.name,
      model = excluded.model,
      fallback_models = excluded.fallback_models,
      system_prompt = excluded.system_prompt,
      tools = excluded.tools,
      updated_at = excluded.updated_at
  `,
  ).run(
    agent.handle,
    agent.name,
    agent.model,
    JSON.stringify(agent.fallbackModels ?? []),
    agent.systemPrompt,
    JSON.stringify(agent.tools),
  )
  return agent
}

export function deleteAgent(handle: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM agents WHERE handle = ?').run(handle)
  return result.changes > 0
}
