/**
 * tunnel.ts — Cloudflare Quick Tunnel via cloudflared binary
 *
 * Downloads cloudflared on first use to ~/.open-greg/bin/cloudflared.
 * Uses the free "quick tunnel" feature (no account needed):
 *   cloudflared tunnel --url http://localhost:<port>
 * The public URL is printed to stdout by cloudflared in the format:
 *   https://<random>.trycloudflare.com
 */
import { createWriteStream, existsSync, chmodSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir, platform, arch } from 'node:os'
import { spawn, type ChildProcess } from 'node:child_process'
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

export async function startTunnel(
  port: number,
  onStatus: (msg: string) => void,
): Promise<TunnelHandle> {
  await downloadCloudflared(onStatus)

  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn(
      CLOUDFLARED_BIN,
      ['tunnel', '--url', `http://localhost:${port}`],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) reject(new Error('Timed out waiting for cloudflared tunnel URL (30s)'))
    }, 30_000)

    const handleOutput = (data: Buffer) => {
      const text = data.toString()
      // cloudflared prints the URL to stderr
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
      if (match && !resolved) {
        resolved = true
        clearTimeout(timeout)
        resolve({
          url: match[0],
          stop: () => {
            proc.kill('SIGTERM')
          },
        })
      }
      if (text.includes('failed') || text.includes('error')) {
        onStatus(`[cloudflared] ${text.trim()}`)
      }
    }

    proc.stdout?.on('data', handleOutput)
    proc.stderr?.on('data', handleOutput)

    proc.on('error', (err) => {
      clearTimeout(timeout)
      if (!resolved) reject(err)
    })
  })
}
