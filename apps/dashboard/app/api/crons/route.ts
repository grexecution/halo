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

export async function GET() {
  try {
    const data = readCrons()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read crons: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string
      schedule: string
      goal?: string
      command?: string
    }
    const now = new Date().toISOString()
    const job: CronJob = {
      id: `cron-${Date.now()}`,
      name: body.name,
      schedule: body.schedule,
      ...(body.goal !== undefined ? { goal: body.goal } : {}),
      ...(body.command !== undefined ? { command: body.command } : {}),
      active: true,
      createdAt: now,
      runCount: 0,
    }

    const data = readCrons()
    data.jobs.push(job)
    writeCrons(data)

    return NextResponse.json(job, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create cron job: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
