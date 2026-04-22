import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  indexWorkspaceToMemory,
} from '../workspaces/store'
import type { Workspace } from '../workspaces/store'
import { upsertMemory } from '../memory/store'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DIR = join(homedir(), '.open-greg')

// ── Goals helpers ──────────────────────────────────────────────────────────────

interface Goal {
  id: string
  title: string
  description: string | undefined
  priority: number
  status: string
  createdAt: string
  updatedAt: string
}

function readGoals(): Goal[] {
  const file = join(DIR, 'goals.json')
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as Goal[]
  } catch {
    return []
  }
}

function writeGoals(goals: Goal[]) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, 'goals.json'), JSON.stringify(goals, null, 2), 'utf-8')
}

// ── Settings helpers ───────────────────────────────────────────────────────────

function readSettings(): Record<string, unknown> {
  const file = join(DIR, 'settings.json')
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeSettings(settings: Record<string, unknown>) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8')
}

// ── Execute action ─────────────────────────────────────────────────────────────

type ActionPayload = Record<string, unknown>

async function executeAction(action: ActionPayload): Promise<{ ok: boolean; message: string }> {
  const type = action.type as string

  // ── Workspace actions ────────────────────────────────────────────────────────
  if (type === 'workspace.create') {
    const now = new Date().toISOString()
    const ws: Workspace = {
      id: `ws-${Date.now()}`,
      name: String(action.name ?? 'New Workspace'),
      type: (action.workspaceType as Workspace['type']) ?? 'custom',
      description: String(action.description ?? ''),
      emoji: String(action.emoji ?? '📝'),
      fields: (action.fields as Workspace['fields']) ?? [],
      active: Boolean(action.active ?? false),
      createdAt: now,
      updatedAt: now,
    }
    createWorkspace(ws)
    indexWorkspaceToMemory(ws)
    return { ok: true, message: `Created workspace "${ws.name}"` }
  }

  if (type === 'workspace.update') {
    const id = String(action.id)
    const patch = action.patch as Partial<Workspace>
    const updated = updateWorkspace(id, patch)
    if (!updated) return { ok: false, message: `Workspace ${id} not found` }
    indexWorkspaceToMemory(updated)
    return { ok: true, message: `Updated workspace "${updated.name}"` }
  }

  if (type === 'workspace.delete') {
    deleteWorkspace(String(action.id))
    return { ok: true, message: `Deleted workspace "${String(action.name ?? action.id)}"` }
  }

  // ── Goal actions ─────────────────────────────────────────────────────────────
  if (type === 'goal.create') {
    const goals = readGoals()
    const now = new Date().toISOString()
    const goal: Goal = {
      id: `g-${Date.now()}`,
      title: String(action.title ?? 'New Goal'),
      description: action.description ? String(action.description) : undefined,
      priority: Number(action.priority ?? 5),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    goals.unshift(goal)
    writeGoals(goals)
    return { ok: true, message: `Created goal "${goal.title}"` }
  }

  if (type === 'goal.update') {
    const goals = readGoals()
    const idx = goals.findIndex((g) => g.id === String(action.id))
    if (idx < 0) return { ok: false, message: `Goal ${String(action.id)} not found` }
    const patch = action.patch as Partial<Goal>
    goals[idx] = { ...goals[idx]!, ...patch, updatedAt: new Date().toISOString() }
    writeGoals(goals)
    return { ok: true, message: `Updated goal "${goals[idx]!.title}"` }
  }

  if (type === 'goal.delete') {
    const goals = readGoals()
    const title = String(action.title ?? action.id)
    writeGoals(goals.filter((g) => g.id !== String(action.id)))
    return { ok: true, message: `Deleted goal "${title}"` }
  }

  // ── Memory actions ───────────────────────────────────────────────────────────
  if (type === 'memory.add') {
    const now = new Date().toISOString()
    upsertMemory({
      id: `mem-agent-${Date.now()}`,
      content: String(action.content ?? ''),
      source: 'manual',
      sourceId: undefined,
      type: 'agent_note',
      tags: (action.tags as string[]) ?? [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })
    return { ok: true, message: 'Added to memory' }
  }

  // ── Settings actions (non-security) ──────────────────────────────────────────
  if (type === 'settings.update') {
    const section = String(action.section)
    const BLOCKED = ['permissions', 'auth']
    if (BLOCKED.includes(section)) {
      return { ok: false, message: 'Security settings cannot be changed by agents' }
    }
    const settings = readSettings()
    settings[section] = {
      ...((settings[section] as Record<string, unknown>) ?? {}),
      ...(action.patch as Record<string, unknown>),
    }
    writeSettings(settings)
    return { ok: true, message: `Updated ${section} settings` }
  }

  return { ok: false, message: `Unknown action type: ${type}` }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { action: ActionPayload }
  try {
    const result = await executeAction(body.action)
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 500 })
  }
}
