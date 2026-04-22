/**
 * Agent self-edit tool for docs.
 *
 * F-140: The agent can read and update its own documentation files
 * (FEATURES.md, AUDIT.md, STUCK.md, etc.) as part of self-repair and
 * bounded-iteration loops. All writes go through the normal fs tool
 * so they are permission-gated.
 */
import { fsRead, fsWrite } from './fs.js'
import { join } from 'node:path'

export interface DocsEditOptions {
  /** Absolute path or relative path from repoRoot */
  path: string
  /** New content to write */
  content: string
  /** Repo root for resolving relative paths (default: process.cwd()) */
  repoRoot?: string | undefined
}

export interface DocsEditResult {
  ok: boolean
  error?: string | undefined
}

export interface DocsReadResult {
  ok: boolean
  content?: string | undefined
  error?: string | undefined
}

export function docsRead(opts: { path: string; repoRoot?: string | undefined }): DocsReadResult {
  const root = opts.repoRoot ?? process.cwd()
  const absPath = opts.path.startsWith('/') ? opts.path : join(root, opts.path)
  return fsRead({ path: absPath })
}

export function docsEdit(opts: DocsEditOptions): DocsEditResult {
  const root = opts.repoRoot ?? process.cwd()
  const absPath = opts.path.startsWith('/') ? opts.path : join(root, opts.path)
  return fsWrite({ path: absPath, content: opts.content })
}

/**
 * Patch a specific section of a markdown file by replacing content between
 * two heading markers. Uses a simple string replace — not AST-aware.
 */
export function docsPatch(opts: {
  path: string
  startMarker: string
  endMarker: string
  replacement: string
  repoRoot?: string | undefined
}): DocsEditResult {
  const read = docsRead({ path: opts.path, repoRoot: opts.repoRoot })
  if (!read.ok || !read.content) return { ok: false, error: read.error }

  const { content } = read
  const startIdx = content.indexOf(opts.startMarker)
  const endIdx = content.indexOf(opts.endMarker, startIdx + opts.startMarker.length)

  if (startIdx === -1) {
    return { ok: false, error: `Start marker not found: ${opts.startMarker}` }
  }
  if (endIdx === -1) {
    return { ok: false, error: `End marker not found: ${opts.endMarker}` }
  }

  const before = content.slice(0, startIdx + opts.startMarker.length)
  const after = content.slice(endIdx)
  const patched = `${before}\n${opts.replacement}\n${after}`

  return docsEdit({ path: opts.path, content: patched, repoRoot: opts.repoRoot })
}
