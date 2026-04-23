export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { spawn, execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { getDb } from '../../lib/db'

const DIR = join(homedir(), '.open-greg')

interface TunnelRow {
  running: number
  url: string | null
  pid: number | null
  started_at: string | null
  mode: string
}

function readState() {
  const db = getDb()
  const row = db
    .prepare('SELECT running, url, pid, started_at, mode FROM tunnel WHERE id = 1')
    .get() as TunnelRow | undefined
  if (!row) return { running: false, url: null, pid: null, startedAt: null, mode: 'quick' as const }
  return {
    running: row.running === 1,
    url: row.url,
    pid: row.pid,
    startedAt: row.started_at,
    mode: (row.mode ?? 'quick') as 'quick' | 'named',
  }
}

function writeState(s: {
  running: boolean
  url: string | null
  pid: number | null
  startedAt: string | null
  mode: 'quick' | 'named'
}) {
  const db = getDb()
  db.prepare(
    `INSERT INTO tunnel (id, running, url, pid, started_at, mode)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       running = excluded.running,
       url = excluded.url,
       pid = excluded.pid,
       started_at = excluded.started_at,
       mode = excluded.mode`,
  ).run(s.running ? 1 : 0, s.url, s.pid, s.startedAt, s.mode)
}

function isCloudflaredInstalled(): boolean {
  try {
    execSync('which cloudflared', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// GET — return current tunnel status
export function GET() {
  const state = readState()
  const installed = isCloudflaredInstalled()

  // Check if PID is still alive
  if (state.running && state.pid && !isPidRunning(state.pid)) {
    writeState({ ...state, running: false, pid: null, url: null })
    return NextResponse.json({ installed, running: false, url: null, startedAt: null })
  }

  return NextResponse.json({ installed, ...state })
}

// POST — start or stop tunnel
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { action: 'start' | 'stop'; port?: number }

  if (body.action === 'stop') {
    const state = readState()
    if (state.pid) {
      try {
        process.kill(state.pid, 'SIGTERM')
      } catch {
        /* already dead */
      }
    }
    writeState({ running: false, url: null, pid: null, startedAt: null, mode: 'quick' })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'start') {
    if (!isCloudflaredInstalled()) {
      return NextResponse.json({ error: 'cloudflared not installed' }, { status: 400 })
    }

    const port = body.port ?? 3000
    const logFile = join(DIR, 'tunnel.log')

    const proc = spawn(
      'cloudflared',
      ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let url: string | null = null

    const extractUrl = (chunk: Buffer) => {
      const text = chunk.toString()
      const match = text.match(/https?:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
      if (match && !url) {
        url = match[0]!
        writeState({
          running: true,
          url,
          pid: proc.pid ?? null,
          startedAt: new Date().toISOString(),
          mode: 'quick',
        })
      }
      try {
        writeFileSync(logFile, text, { flag: 'a' })
      } catch {
        /* ignore */
      }
    }

    proc.stdout?.on('data', extractUrl)
    proc.stderr?.on('data', extractUrl)
    proc.unref()

    // Wait up to 8s for the URL to appear
    const start = Date.now()
    while (!url && Date.now() - start < 8000) {
      await new Promise((r) => setTimeout(r, 200))
    }

    if (!url) {
      return NextResponse.json(
        {
          error: 'Tunnel started but URL not detected yet — check back in a moment',
          pid: proc.pid,
        },
        { status: 202 },
      )
    }

    return NextResponse.json({ ok: true, url, pid: proc.pid })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
