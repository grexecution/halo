/**
 * F-043: Sudo toggle
 */
import { describe, it, expect } from 'vitest'
import { createMiddleware, type PermissionConfig } from '../src/index.js'

describe('F-043: Sudo toggle', () => {
  it('blocks sudo commands when sudo is disabled', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: false },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'sudo ls /root' }, { userId: 'u1' })
    // Sudo commands should be denied when sudo:false
    expect(result.decision).toBe('deny')
  })

  it('allows sudo commands when sudo is enabled', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: true },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'sudo ls /root' }, { userId: 'u1' })
    expect(result.decision).toBe('allow')
  })

  it('non-sudo commands are allowed regardless of sudo setting', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: false },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'echo hello' }, { userId: 'u1' })
    expect(result.decision).toBe('allow')
  })
})
