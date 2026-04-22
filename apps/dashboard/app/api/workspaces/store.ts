import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { upsertMemory } from '../memory/store'

export type WorkspaceType = 'client' | 'personal' | 'project' | 'team' | 'custom'
export type FieldType = 'text' | 'url' | 'code' | 'secret'

export interface WorkspaceField {
  id: string
  key: string
  value: string
  type: FieldType
}

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  description: string
  emoji: string
  fields: WorkspaceField[]
  active: boolean
  createdAt: string
  updatedAt: string
}

const DIR = join(homedir(), '.open-greg')
const FILE = join(DIR, 'workspaces.json')

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

function read(): { workspaces: Workspace[] } {
  if (!existsSync(FILE)) return { workspaces: [] }
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')) as { workspaces: Workspace[] }
  } catch {
    return { workspaces: [] }
  }
}

function write(store: { workspaces: Workspace[] }) {
  ensureDir()
  writeFileSync(FILE, JSON.stringify(store, null, 2), 'utf-8')
}

export function listWorkspaces(): Workspace[] {
  return read().workspaces
}

export function getWorkspace(id: string): Workspace | undefined {
  return read().workspaces.find((w) => w.id === id)
}

export function createWorkspace(ws: Workspace): Workspace {
  const store = read()
  store.workspaces.unshift(ws)
  write(store)
  return ws
}

export function updateWorkspace(id: string, patch: Partial<Workspace>): Workspace | null {
  const store = read()
  const idx = store.workspaces.findIndex((w) => w.id === id)
  if (idx < 0) return null
  store.workspaces[idx] = {
    ...store.workspaces[idx]!,
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  }
  write(store)
  return store.workspaces[idx]!
}

export function deleteWorkspace(id: string): boolean {
  const store = read()
  const prev = store.workspaces.length
  store.workspaces = store.workspaces.filter((w) => w.id !== id)
  if (store.workspaces.length === prev) return false
  write(store)
  return true
}

export function getActiveWorkspaces(): Workspace[] {
  return read().workspaces.filter((w) => w.active)
}

export function indexWorkspaceToMemory(ws: Workspace) {
  const lines = [`Workspace: ${ws.name} (${ws.type})`]
  if (ws.description) lines.push(`Description: ${ws.description}`)
  for (const f of ws.fields) {
    if (f.value && f.type !== 'secret') lines.push(`${f.key}: ${f.value}`)
  }
  upsertMemory({
    id: `ws-${ws.id}`,
    content: lines.join('\n'),
    source: 'workspace',
    sourceId: ws.id,
    type: 'workspace_context',
    tags: [ws.name, ws.type],
    metadata: { workspaceId: ws.id, workspaceName: ws.name },
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  })
}
