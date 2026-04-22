/**
 * F-051: Filesystem read/write
 * Permission-checked file operations.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { fsReadTool, fsWriteTool } from '../src/fs.js'
import { createMiddleware } from '@open-greg/permissions'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir as osTmpdir } from 'node:os'

const tmpDir = mkdtempSync(join(osTmpdir(), 'open-greg-fs-'))
const allowConfig = {
  tools: { 'fs.read': { allow: true }, 'fs.write': { allow: true } },
  filesystem: { sudo: false, allowed_paths: [tmpDir] },
}
const denyConfig = {
  tools: { 'fs.read': { allow: false }, 'fs.write': { allow: false } },
}

describe('F-051: Filesystem read/write', () => {
  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    mkdtempSync(join(osTmpdir(), 'open-greg-fs-'))
  })

  it('writes a file within allowed path', async () => {
    const mw = createMiddleware(allowConfig)
    const path = join(tmpDir, 'test.txt')
    const result = await fsWriteTool.run(
      { path, content: 'hello' },
      {
        sessionId: 's1',
        agentId: 'a1',
        middleware: mw,
      },
    )
    expect(result.ok).toBe(true)
  })

  it('reads a file within allowed path', async () => {
    const mw = createMiddleware(allowConfig)
    const path = join(tmpDir, 'read-test.txt')
    await fsWriteTool.run(
      { path, content: 'hello world' },
      {
        sessionId: 's1',
        agentId: 'a1',
        middleware: mw,
      },
    )
    const result = await fsReadTool.run(
      { path },
      {
        sessionId: 's1',
        agentId: 'a1',
        middleware: mw,
      },
    )
    expect(result.content).toBe('hello world')
  })

  it('denies write when permission not granted', async () => {
    const mw = createMiddleware(denyConfig)
    await expect(
      fsWriteTool.run(
        { path: '/tmp/x.txt', content: 'x' },
        {
          sessionId: 's1',
          agentId: 'a1',
          middleware: mw,
        },
      ),
    ).rejects.toThrow(/denied/i)
  })
})
