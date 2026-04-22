import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const INSTANCES_FILE = resolve(homedir(), '.claw-alt', 'instances.json')

interface StoredInstance {
  id: string
  name: string
  url: string
  addedAt: string
}

function readInstances(): StoredInstance[] {
  try {
    if (!existsSync(INSTANCES_FILE)) return []
    return JSON.parse(readFileSync(INSTANCES_FILE, 'utf-8')) as StoredInstance[]
  } catch {
    return []
  }
}

function writeInstances(instances: StoredInstance[]): void {
  const dir = resolve(homedir(), '.claw-alt')
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(INSTANCES_FILE, JSON.stringify(instances, null, 2))
  } catch {
    /* ignore write failures */
  }
}

async function pingInstance(
  url: string,
): Promise<{ status: 'online' | 'offline'; data?: Record<string, unknown> }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${url}/api/status`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return { status: 'offline' }
    const data = (await res.json()) as Record<string, unknown>
    return { status: 'online', data }
  } catch {
    return { status: 'offline' }
  }
}

export async function GET() {
  const stored = readInstances()

  // Always include local instance
  const localUrl = `http://localhost:${process.env['PORT'] ?? 3030}`
  const localPing = await pingInstance(localUrl)

  const localInstance = {
    id: 'local',
    name: 'Local',
    url: localUrl,
    status: 'online' as const,
    lastSeen: new Date().toISOString(),
    version: '0.1.0',
    agentCount: (localPing.data?.['agentCount'] as number | undefined) ?? 0,
    activeGoals: (localPing.data?.['activeGoals'] as number | undefined) ?? 0,
    llmModel: (localPing.data?.['llmModel'] as string | undefined) ?? 'local',
  }

  const remotes = await Promise.all(
    stored
      .filter((s) => !s.url.includes('localhost') && !s.url.includes('127.0.0.1'))
      .map(async (s) => {
        const ping = await pingInstance(s.url)
        return {
          id: s.id,
          name: s.name || new URL(s.url).hostname,
          url: s.url,
          status: ping.status,
          lastSeen: ping.status === 'online' ? new Date().toISOString() : undefined,
          version: ping.data?.['version'] as string | undefined,
          agentCount: ping.data?.['agentCount'] as number | undefined,
          activeGoals: ping.data?.['activeGoals'] as number | undefined,
          llmModel: ping.data?.['llmModel'] as string | undefined,
        }
      }),
  )

  return NextResponse.json({ instances: [localInstance, ...remotes] })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { url?: string; name?: string }
  const url = body.url?.trim()
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const instances = readInstances()
  if (instances.some((i) => i.url === url)) {
    return NextResponse.json({ error: 'already registered' }, { status: 409 })
  }

  const id = `inst-${Date.now()}`
  instances.push({
    id,
    name: body.name ?? new URL(url).hostname,
    url,
    addedAt: new Date().toISOString(),
  })
  writeInstances(instances)

  return NextResponse.json({ id, url }, { status: 201 })
}
