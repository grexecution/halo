/**
 * Filesystem read/write tools.
 *
 * Canonical implementations; mastra-tools.ts delegates here.
 * All paths are absolute or resolve relative to homedir.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'

function resolvePath(p: string): string {
  if (p.startsWith('/')) return p
  return join(homedir(), p)
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface FsReadOptions {
  path: string
  encoding?: BufferEncoding
}

export interface FsReadResult {
  ok: boolean
  content?: string
  error?: string
}

export function fsRead(opts: FsReadOptions): FsReadResult {
  const absPath = resolvePath(opts.path)
  try {
    const content = readFileSync(absPath, opts.encoding ?? 'utf-8')
    return { ok: true, content: content as string }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface FsWriteOptions {
  path: string
  content: string
  encoding?: BufferEncoding
}

export interface FsWriteResult {
  ok: boolean
  error?: string
}

export function fsWrite(opts: FsWriteOptions): FsWriteResult {
  const absPath = resolvePath(opts.path)
  try {
    const dir = dirname(absPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(absPath, opts.content, opts.encoding ?? 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// List directory
// ---------------------------------------------------------------------------

export interface FsListOptions {
  path: string
}

export interface FsListResult {
  ok: boolean
  entries?: Array<{ name: string; type: 'file' | 'dir' }>
  error?: string
}

export function fsList(opts: FsListOptions): FsListResult {
  const absPath = resolvePath(opts.path)
  try {
    const names = readdirSync(absPath)
    const entries = names.map((name) => {
      const stat = statSync(resolve(absPath, name))
      return { name, type: (stat.isDirectory() ? 'dir' : 'file') as 'file' | 'dir' }
    })
    return { ok: true, entries }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export interface FsDeleteOptions {
  path: string
  recursive?: boolean
}

export interface FsDeleteResult {
  ok: boolean
  error?: string
}

export function fsDelete(opts: FsDeleteOptions): FsDeleteResult {
  const absPath = resolvePath(opts.path)
  try {
    rmSync(absPath, { recursive: opts.recursive ?? false })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
