import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

interface Goal {
  id: string
  title: string
  description?: string
  priority: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

interface GoalsFile {
  goals: Goal[]
}

function getDataDir(): string {
  return resolve(homedir(), '.open-greg')
}

function ensureDataDir(): void {
  const dir = getDataDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getGoalsPath(): string {
  return resolve(getDataDir(), 'goals.json')
}

function readGoals(): GoalsFile {
  const path = getGoalsPath()
  if (!existsSync(path)) return { goals: [] }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as GoalsFile
  } catch {
    return { goals: [] }
  }
}

function writeGoals(data: GoalsFile): void {
  ensureDataDir()
  writeFileSync(getGoalsPath(), JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = readGoals()
    const goal = data.goals.find((g) => g.id === id)
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    return NextResponse.json(goal)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      title?: string
      description?: string
      priority?: number
      status?: 'pending' | 'running' | 'completed' | 'failed'
    }

    const data = readGoals()
    const index = data.goals.findIndex((g) => g.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const goal = data.goals[index]!
    if (body.title !== undefined) goal.title = body.title
    if (body.description !== undefined) goal.description = body.description
    if (body.priority !== undefined) goal.priority = body.priority
    if (body.status !== undefined) goal.status = body.status
    goal.updatedAt = new Date().toISOString()

    writeGoals(data)
    return NextResponse.json(goal)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to update goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = readGoals()
    const before = data.goals.length
    data.goals = data.goals.filter((g) => g.id !== id)
    if (data.goals.length === before) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    writeGoals(data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to delete goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
