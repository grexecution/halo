/**
 * F-041: Tool-call middleware
 * Verifies that every tool call routes through check(toolId, args, ctx).
 */
import { describe, it, expect } from 'vitest'
import { createMiddleware, type PermissionConfig } from '../src/index.js'

const allowConfig: PermissionConfig = {
  tools: {
    get_time: { allow: true },
    shell_exec: { allow: false },
  },
  network: { url_whitelist_mode: false },
  filesystem: { sudo: false, allowed_paths: ['/tmp'] },
}

describe('F-041: Tool-call middleware', () => {
  it('allows a tool that is explicitly permitted', async () => {
    const mw = createMiddleware(allowConfig)
    const result = await mw.check('get_time', {}, { userId: 'u1' })
    expect(result.decision).toBe('allow')
  })

  it('denies a tool that is explicitly forbidden', async () => {
    const mw = createMiddleware(allowConfig)
    const result = await mw.check('shell_exec', { cmd: 'ls' }, { userId: 'u1' })
    expect(result.decision).toBe('deny')
  })

  it('allows an unlisted tool by default (open policy)', async () => {
    const mw = createMiddleware(allowConfig)
    const result = await mw.check('unknown_tool', {}, { userId: 'u1' })
    expect(result.decision).toBe('allow')
  })

  it('denies when all tools locked down via wildcard deny', async () => {
    const lockdown: PermissionConfig = {
      tools: { '*': { allow: false } },
    }
    const mw = createMiddleware(lockdown)
    const result = await mw.check('get_time', {}, { userId: 'u1' })
    expect(result.decision).toBe('deny')
  })

  it('provides a reason on denial', async () => {
    const mw = createMiddleware(allowConfig)
    const result = await mw.check('shell_exec', {}, { userId: 'u1' })
    expect(result.reason).toBeDefined()
    expect(typeof result.reason).toBe('string')
  })
})
