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
import { getDb } from '../../lib/db'
import { readSettings, writeSettings } from '../settings/store'
import type { Settings } from '../settings/store'

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
      documents: [],
      active: Boolean(action.active ?? false),
      createdAt: now,
      updatedAt: now,
    }
    createWorkspace(ws)
    void indexWorkspaceToMemory(ws)
    return { ok: true, message: `Created workspace "${ws.name}"` }
  }

  if (type === 'workspace.update') {
    const id = String(action.id)
    const patch = action.patch as Partial<Workspace>
    const updated = updateWorkspace(id, patch)
    if (!updated) return { ok: false, message: `Workspace ${id} not found` }
    void indexWorkspaceToMemory(updated)
    return { ok: true, message: `Updated workspace "${updated.name}"` }
  }

  if (type === 'workspace.delete') {
    deleteWorkspace(String(action.id))
    return { ok: true, message: `Deleted workspace "${String(action.name ?? action.id)}"` }
  }

  // ── Goal actions (SQLite) ────────────────────────────────────────────────────
  if (type === 'goal.create') {
    const db = getDb()
    const now = new Date().toISOString()
    const id = `g-${Date.now()}`
    db.prepare(
      'INSERT INTO goals (id, title, description, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      String(action.title ?? 'New Goal'),
      action.description ? String(action.description) : null,
      Number(action.priority ?? 5),
      'pending',
      now,
      now,
    )
    return { ok: true, message: `Created goal "${String(action.title ?? 'New Goal')}"` }
  }

  if (type === 'goal.update') {
    const db = getDb()
    const id = String(action.id)
    const row = db.prepare('SELECT id FROM goals WHERE id = ?').get(id)
    if (!row) return { ok: false, message: `Goal ${id} not found` }
    const patch = action.patch as Record<string, unknown>
    const now = new Date().toISOString()
    if (patch.title !== undefined)
      db.prepare('UPDATE goals SET title=?, updated_at=? WHERE id=?').run(
        String(patch.title),
        now,
        id,
      )
    if (patch.description !== undefined)
      db.prepare('UPDATE goals SET description=?, updated_at=? WHERE id=?').run(
        patch.description ? String(patch.description) : null,
        now,
        id,
      )
    if (patch.priority !== undefined)
      db.prepare('UPDATE goals SET priority=?, updated_at=? WHERE id=?').run(
        Number(patch.priority),
        now,
        id,
      )
    if (patch.status !== undefined)
      db.prepare('UPDATE goals SET status=?, updated_at=? WHERE id=?').run(
        String(patch.status),
        now,
        id,
      )
    return { ok: true, message: `Updated goal ${id}` }
  }

  if (type === 'goal.delete') {
    const db = getDb()
    const id = String(action.id)
    db.prepare('DELETE FROM goals WHERE id = ?').run(id)
    return { ok: true, message: `Deleted goal "${String(action.title ?? id)}"` }
  }

  // ── Memory actions ───────────────────────────────────────────────────────────
  if (type === 'memory.add') {
    const now = new Date().toISOString()
    await upsertMemory({
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

  // ── Settings actions (non-security, via SQLite store) ────────────────────────
  if (type === 'settings.update') {
    const section = String(action.section)
    const BLOCKED = ['permissions', 'auth']
    if (BLOCKED.includes(section)) {
      return { ok: false, message: 'Security settings cannot be changed by agents' }
    }
    const current = readSettings()
    const patch = action.patch as Record<string, unknown>
    // Deep-merge the section
    const updated: Settings = {
      ...current,
      [section]: {
        ...((current[section as keyof Settings] as Record<string, unknown>) ?? {}),
        ...patch,
      },
    }
    writeSettings(updated)
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
