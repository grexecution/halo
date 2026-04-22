import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { spawn, execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DIR = join(homedir(), '.open-greg')
const STATE_FILE = join(DIR, 'tunnel.json')

interface TunnelState {
  running: boolean
  url: string | null
  pid: number | null
  startedAt: string | null
  mode: 'quick' | 'named'
}

function readState(): TunnelState {
  if (!existsSync(STATE_FILE))
    return { running: false, url: null, pid: null, startedAt: null, mode: 'quick' }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as TunnelState
  } catch {
    return { running: false, url: null, pid: null, startedAt: null, mode: 'quick' }
  }
}

function writeState(s: TunnelState) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf-8')
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

    // Use quick tunnel (no account needed) — output URL to stdout
    const proc = spawn(
      'cloudflared',
      ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let url: string | null = null

    // cloudflared prints the URL to stderr in the form: "https://xxx.trycloudflare.com"
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
      // append to log
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
