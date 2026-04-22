/**
 * F-050: Shell exec tool
 * Permission-checked shell command execution.
 */
import { describe, it, expect } from 'vitest'
import { shellExecTool } from '../src/shell.js'
import { createMiddleware } from '@open-greg/permissions'
import type { PermissionConfig } from '@open-greg/permissions'

const allowConfig: PermissionConfig = {
  tools: { shell_exec: { allow: true } },
  filesystem: { sudo: false, allowed_paths: ['/tmp'] },
}

const denyConfig: PermissionConfig = {
  tools: { shell_exec: { allow: false } },
}

describe('F-050: Shell exec', () => {
  it('executes a simple command when permission is granted', async () => {
    const mw = createMiddleware(allowConfig)
    const result = await shellExecTool.run(
      { cmd: 'echo hi', cwd: '/tmp' },
      {
        sessionId: 's1',
        agentId: 'a1',
        middleware: mw,
      },
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hi')
  })

  it('denies execution when permission is not granted', async () => {
    const mw = createMiddleware(denyConfig)
    await expect(
      shellExecTool.run(
        { cmd: 'echo hi' },
        {
          sessionId: 's1',
          agentId: 'a1',
          middleware: mw,
        },
      ),
    ).rejects.toThrow(/denied/i)
  })

  it('captures stdout and stderr', async () => {
    const mw = createMiddleware(allowConfig)
    const result = await shellExecTool.run(
      { cmd: 'echo hello && echo world >&2', cwd: '/tmp' },
      {
        sessionId: 's1',
        agentId: 'a1',
        middleware: mw,
      },
    )
    expect(result.stdout).toContain('hello')
  })
})
