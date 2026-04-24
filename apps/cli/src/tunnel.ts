/**
 * tunnel.ts — Cloudflare Quick Tunnel via cloudflared binary
 *
 * Downloads cloudflared on first use to ~/.open-greg/bin/cloudflared.
 * Uses the free "quick tunnel" feature (no account needed):
 *   cloudflared tunnel --url http://localhost:<port>
 * The public URL is printed to stdout by cloudflared in the format:
 *   https://<random>.trycloudflare.com
 */
import { createWriteStream, existsSync, chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir, platform, arch } from 'node:os'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

const BIN_DIR = resolve(homedir(), '.open-greg', 'bin')
const CLOUDFLARED_BIN = resolve(
  BIN_DIR,
  process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
)

function getDownloadUrl(): string {
  const p = platform()
  const a = arch()
  const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download'

  if (p === 'linux' && (a === 'x64' || a === 'x86_64')) return `${base}/cloudflared-linux-amd64`
  if (p === 'linux' && (a === 'arm64' || a === 'aarch64')) return `${base}/cloudflared-linux-arm64`
  if (p === 'darwin' && a === 'x64') return `${base}/cloudflared-darwin-amd64.tgz`
  if (p === 'darwin' && a === 'arm64') return `${base}/cloudflared-darwin-arm64.tgz`
  throw new Error(`Unsupported platform for cloudflared: ${p}/${a}`)
}

async function downloadCloudflared(onStatus: (msg: string) => void): Promise<void> {
  if (existsSync(CLOUDFLARED_BIN)) return

  mkdirSync(BIN_DIR, { recursive: true, mode: 0o700 })
  const url = getDownloadUrl()
  onStatus(`Downloading cloudflared from ${url}...`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download cloudflared: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const isTarball = url.endsWith('.tgz')
  if (isTarball) {
    // On macOS, download to tmp then extract
    const { execSync } = await import('node:child_process')
    const tmpTar = resolve(BIN_DIR, 'cloudflared.tgz')
    const writer = createWriteStream(tmpTar)
    await pipeline(res.body as unknown as NodeJS.ReadableStream, writer)
    execSync(`tar -xzf "${tmpTar}" -C "${BIN_DIR}"`, { stdio: 'ignore' })
    // The extracted binary name varies — find it
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(BIN_DIR).filter(
      (f) => f.startsWith('cloudflared') && !f.endsWith('.tgz'),
    )
    if (files.length === 0) throw new Error('cloudflared binary not found after extraction')
    const { renameSync } = await import('node:fs')
    renameSync(resolve(BIN_DIR, files[0]!), CLOUDFLARED_BIN)
    const { unlinkSync } = await import('node:fs')
    unlinkSync(tmpTar)
  } else {
    const writer = createWriteStream(CLOUDFLARED_BIN)
    await pipeline(res.body as unknown as NodeJS.ReadableStream, writer)
  }

  chmodSync(CLOUDFLARED_BIN, 0o755)
  onStatus('cloudflared downloaded.')
}

export interface TunnelHandle {
  url: string
  stop: () => void
}

const TUNNEL_URL_FILE = resolve(homedir(), '.open-greg', 'tunnel-url.txt')
const SYSTEMD_SERVICE = 'halo-tunnel'

// ── Install cloudflared as a persistent systemd service ───────────────────────
// On Linux with systemd: creates a service unit so the tunnel survives reboots
// and CLI exit. On macOS / no systemd: falls back to detached spawn.

async function installSystemdService(port: number): Promise<void> {
  const { writeFileSync } = await import('node:fs')
  const unit = `[Unit]
Description=Halo Cloudflare Tunnel
After=network.target

[Service]
ExecStart=${CLOUDFLARED_BIN} tunnel --url http://localhost:${port}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`
  writeFileSync(`/etc/systemd/system/${SYSTEMD_SERVICE}.service`, unit)
  const { execSync } = await import('node:child_process')
  execSync(`systemctl daemon-reload && systemctl enable --now ${SYSTEMD_SERVICE}`, {
    stdio: 'ignore',
  })
}

function hasSystemd(): boolean {
  try {
    execSync('systemctl --version', { stdio: 'ignore', timeout: 3000 })
    // also need to be root to write to /etc/systemd
    return process.getuid?.() === 0
  } catch {
    return false
  }
}

// Wait for cloudflared to print its trycloudflare URL, reading from journalctl
// (systemd) or a pipe (fallback).
async function waitForTunnelUrl(
  proc: ChildProcess | null,
  onStatus: (msg: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) reject(new Error('Timed out waiting for cloudflared URL (60s)'))
    }, 60_000)

    const tryMatch = (text: string) => {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
      if (match && !resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve(match[0]!)
      }
      if (text.includes('failed') || text.includes('ERR')) {
        onStatus(`[cloudflared] ${text.slice(0, 120)}`)
      }
    }

    if (proc) {
      proc.stdout?.on('data', (d: Buffer) => tryMatch(d.toString()))
      proc.stderr?.on('data', (d: Buffer) => tryMatch(d.toString()))
      proc.on('error', (err) => {
        clearTimeout(timeout)
        if (!resolved) reject(err)
      })
      return
    }

    // systemd: poll journalctl for the URL
    const jctl = spawn('journalctl', ['-u', SYSTEMD_SERVICE, '-f', '--no-pager', '-n', '50'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    jctl.stdout?.on('data', (d: Buffer) => tryMatch(d.toString()))
    jctl.stderr?.on('data', (d: Buffer) => tryMatch(d.toString()))
    jctl.on('error', (err: Error) => {
      clearTimeout(timeout)
      if (!resolved) reject(err)
    })
  })
}

export async function startTunnel(
  port: number,
  onStatus: (msg: string) => void,
): Promise<TunnelHandle> {
  await downloadCloudflared(onStatus)

  let proc: ChildProcess | null = null

  if (hasSystemd()) {
    // Install + start as a persistent systemd service
    onStatus('Installing tunnel as systemd service...')
    await installSystemdService(port)
  } else {
    // Detached spawn — survives CLI exit on macOS / non-systemd Linux
    proc = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    proc.unref() // don't keep the Node process alive waiting for it
  }

  const url = await waitForTunnelUrl(proc, onStatus)

  // Persist URL so the dashboard can read it after CLI exits
  mkdirSync(resolve(homedir(), '.open-greg'), { recursive: true })
  writeFileSync(TUNNEL_URL_FILE, url, 'utf-8')

  return {
    url,
    stop: () => {
      if (proc) proc.kill('SIGTERM')
      else {
        try {
          execSync(`systemctl stop ${SYSTEMD_SERVICE}`, { stdio: 'ignore' })
        } catch {
          /* ignore */
        }
      }
    },
  }
}
