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

export async function GET() {
  try {
    const data = readGoals()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read goals: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title: string
      description?: string
      priority?: number
    }
    const now = new Date().toISOString()
    const goal: Goal = {
      id: `goal-${Date.now()}`,
      title: body.title,
      ...(body.description !== undefined ? { description: body.description } : {}),
      priority: body.priority ?? 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }

    const data = readGoals()
    data.goals.push(goal)
    writeGoals(data)

    return NextResponse.json(goal, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create goal: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
