import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

interface CronJob {
  id: string
  name: string
  schedule: string
  goal?: string
  command?: string
  active: boolean
  createdAt: string
  lastRunAt?: string
  lastRunStatus?: 'success' | 'failed'
  nextRunAt?: string
  runCount: number
}

interface CronsFile {
  jobs: CronJob[]
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

function getCronsPath(): string {
  return resolve(getDataDir(), 'crons.json')
}

function readCrons(): CronsFile {
  const path = getCronsPath()
  if (!existsSync(path)) return { jobs: [] }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CronsFile
  } catch {
    return { jobs: [] }
  }
}

function writeCrons(data: CronsFile): void {
  ensureDataDir()
  writeFileSync(getCronsPath(), JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = readCrons()
    const job = data.jobs.find((j) => j.id === id)
    if (!job) {
      return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    }
    return NextResponse.json(job)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      name?: string
      schedule?: string
      active?: boolean
      goal?: string
      command?: string
    }

    const data = readCrons()
    const index = data.jobs.findIndex((j) => j.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    }

    const job = data.jobs[index]!
    if (body.name !== undefined) job.name = body.name
    if (body.schedule !== undefined) job.schedule = body.schedule
    if (body.active !== undefined) job.active = body.active
    if (body.goal !== undefined) job.goal = body.goal
    if (body.command !== undefined) job.command = body.command

    writeCrons(data)
    return NextResponse.json(job)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to update cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = readCrons()
    const before = data.jobs.length
    data.jobs = data.jobs.filter((j) => j.id !== id)
    if (data.jobs.length === before) {
      return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    }
    writeCrons(data)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to delete cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
