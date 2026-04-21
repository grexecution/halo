/**
 * F-167: Security regression suite — permissions
 */
import { describe, it, expect } from 'vitest'
import { createMiddleware, type PermissionConfig } from '../../packages/permissions/src/index.js'

describe('F-167: Security regression — permissions', () => {
  it('denied paths stay denied even when tool is explicitly listed', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: false } },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'ls' }, { userId: 'u1' })
    expect(result.decision).toBe('deny')
  })

  it('wildcard deny blocks all tools', async () => {
    const config: PermissionConfig = {
      tools: { '*': { allow: false } },
    }
    const mw = createMiddleware(config)
    const r1 = await mw.check('shell_exec', {}, {})
    const r2 = await mw.check('fs.read', {}, {})
    const r3 = await mw.check('browser.act', {}, {})
    expect(r1.decision).toBe('deny')
    expect(r2.decision).toBe('deny')
    expect(r3.decision).toBe('deny')
  })

  it('sudo toggle actually blocks sudo commands', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: false },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'sudo rm -rf /etc' }, { userId: 'u1' })
    expect(result.decision).toBe('deny')
    expect(result.reason).toMatch(/sudo/i)
  })

  it('sudo enabled allows sudo commands', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: true },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'sudo apt-get update' }, { userId: 'u1' })
    expect(result.decision).toBe('allow')
  })

  it('no tool config means allow by default', async () => {
    const config: PermissionConfig = {}
    const mw = createMiddleware(config)
    const result = await mw.check('any_tool', {}, {})
    expect(result.decision).toBe('allow')
  })
})
