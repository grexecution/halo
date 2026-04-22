/**
 * F-140: Agent self-edit docs tool
 *
 * Tests the docsRead / docsEdit / docsPatch functions.
 * Uses a temp dir so no real repo files are touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { docsRead, docsEdit, docsPatch } from '../src/docs-edit.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = join(tmpdir(), `docs-edit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
})

describe('F-140: Agent self-edit docs', () => {
  it('docsRead reads an existing file', () => {
    const filePath = join(tmpDir, 'readme.md')
    writeFileSync(filePath, '# Hello\nContent here.')
    const result = docsRead({ path: filePath })
    expect(result.ok).toBe(true)
    expect(result.content).toContain('# Hello')
  })

  it('docsRead returns ok=false for a missing file', () => {
    const result = docsRead({ path: join(tmpDir, 'nonexistent.md') })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('docsEdit writes content to a file', () => {
    const filePath = join(tmpDir, 'AUDIT.md')
    const result = docsEdit({ path: filePath, content: '# Audit\nAll good.' })
    expect(result.ok).toBe(true)
    const written = readFileSync(filePath, 'utf-8')
    expect(written).toBe('# Audit\nAll good.')
  })

  it('docsEdit overwrites an existing file', () => {
    const filePath = join(tmpDir, 'doc.md')
    writeFileSync(filePath, 'old content')
    docsEdit({ path: filePath, content: 'new content' })
    const written = readFileSync(filePath, 'utf-8')
    expect(written).toBe('new content')
  })

  it('docsPatch replaces content between two markers', () => {
    const filePath = join(tmpDir, 'features.md')
    writeFileSync(filePath, '## Status\n<!-- START -->\nold section\n<!-- END -->\n## Other\n')
    const result = docsPatch({
      path: filePath,
      startMarker: '<!-- START -->',
      endMarker: '<!-- END -->',
      replacement: 'new section',
      repoRoot: tmpDir,
    })
    expect(result.ok).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('new section')
    expect(content).not.toContain('old section')
  })

  it('docsPatch returns ok=false when start marker not found', () => {
    const filePath = join(tmpDir, 'missing-marker.md')
    writeFileSync(filePath, 'no markers here')
    const result = docsPatch({
      path: filePath,
      startMarker: '<!-- MISSING -->',
      endMarker: '<!-- END -->',
      replacement: 'new',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Start marker not found')
  })

  it('docsPatch returns ok=false when end marker not found', () => {
    const filePath = join(tmpDir, 'no-end.md')
    writeFileSync(filePath, '<!-- START -->\nsome content\n')
    const result = docsPatch({
      path: filePath,
      startMarker: '<!-- START -->',
      endMarker: '<!-- END -->',
      replacement: 'new',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('End marker not found')
  })

  it('docsEdit uses repoRoot to resolve relative paths', () => {
    const result = docsEdit({
      path: 'relative-doc.md',
      content: 'relative write works',
      repoRoot: tmpDir,
    })
    expect(result.ok).toBe(true)
    const filePath = join(tmpDir, 'relative-doc.md')
    expect(readFileSync(filePath, 'utf-8')).toBe('relative write works')
  })
})
