import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DIR = join(homedir(), '.open-greg')
const FILE = join(DIR, 'agents.json')

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
  systemPrompt: string
  tools: AgentTools
}

const DEFAULT_AGENTS: Agent[] = [
  {
    handle: 'main',
    name: 'Main Agent',
    model: 'claude-sonnet-4-6',
    systemPrompt: 'You are a helpful AI assistant.',
    tools: { shell: false, browser: false, filesystem: false, gui: false },
  },
]

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

function read(): Agent[] {
  if (!existsSync(FILE)) return DEFAULT_AGENTS
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')) as Agent[]
  } catch {
    return DEFAULT_AGENTS
  }
}

function write(agents: Agent[]) {
  ensureDir()
  writeFileSync(FILE, JSON.stringify(agents, null, 2), 'utf-8')
}

export function listAgents(): Agent[] {
  return read()
}

export function upsertAgent(agent: Agent): Agent {
  const agents = read()
  const idx = agents.findIndex((a) => a.handle === agent.handle)
  if (idx >= 0) {
    agents[idx] = agent
  } else {
    agents.push(agent)
  }
  write(agents)
  return agent
}

export function deleteAgent(handle: string): boolean {
  const agents = read()
  const filtered = agents.filter((a) => a.handle !== handle)
  if (filtered.length === agents.length) return false
  write(filtered)
  return true
}
