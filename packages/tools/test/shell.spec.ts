/**
 * F-050: Shell execution tool
 *
 * Verifies that shell commands are executed and their output captured.
 */
import { describe, it, expect } from 'vitest'
import { shellExec } from '../src/shell.js'

describe('F-050: Shell execution tool', () => {
  it('executes a simple echo command', async () => {
    const result = await shellExec({ cmd: 'echo hello' })
    expect(result.ok).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
  })

  it('captures stderr separately', async () => {
    const result = await shellExec({ cmd: 'echo error >&2' })
    expect(result.stderr).toContain('error')
  })

  it('returns non-zero exit code for failing commands', async () => {
    const result = await shellExec({ cmd: 'exit 42' })
    expect(result.ok).toBe(false)
    expect(result.exitCode).toBe(42)
  })

  it('captures multi-line output', async () => {
    const result = await shellExec({ cmd: 'echo line1 && echo line2' })
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('line1')
    expect(result.stdout).toContain('line2')
  })

  it('respects custom cwd', async () => {
    const result = await shellExec({ cmd: 'pwd', cwd: '/tmp' })
    expect(result.ok).toBe(true)
    // On macOS /tmp is a symlink to /private/tmp — accept both
    expect(result.stdout.trim()).toMatch(/^\/(?:private\/)?tmp$/)
  })

  it('times out if command exceeds timeoutMs', async () => {
    const result = await shellExec({ cmd: 'sleep 10', timeoutMs: 100 })
    // spawnSync returns null status on timeout
    expect(result.exitCode).not.toBe(0)
  })

  it('handles invalid command gracefully', async () => {
    const result = await shellExec({ cmd: 'command_that_does_not_exist_xyz' })
    expect(result.ok).toBe(false)
  })
})
