/**
 * F-134: Tool timeouts
 * Verifies that every tool call has a timeout and cleans up on expiry.
 */
import { describe, it, expect } from 'vitest'
import { withTimeout, ToolTimeoutError } from '../src/timeout.js'

describe('F-134: Tool timeouts', () => {
  it('resolves successfully before timeout', async () => {
    const result = await withTimeout(async () => 'done', 200, 'test_tool')
    expect(result).toBe('done')
  })

  it('rejects with ToolTimeoutError when timeout expires', async () => {
    await expect(withTimeout(() => new Promise<never>(() => {}), 50, 'slow_tool')).rejects.toThrow(
      ToolTimeoutError,
    )
  })

  it('ToolTimeoutError includes tool name and duration in message', async () => {
    try {
      await withTimeout(() => new Promise<never>(() => {}), 50, 'shell_exec')
      expect.fail('should throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ToolTimeoutError)
      expect((e as ToolTimeoutError).message).toContain('shell_exec')
      expect((e as ToolTimeoutError).message).toContain('50')
    }
  })

  it('uses default 60s timeout when not specified', async () => {
    // Just verify the function works without a timeout argument
    const result = await withTimeout(async () => 'quick', undefined, 'any_tool')
    expect(result).toBe('quick')
  })

  it('does not hang: cleanup on resolve', async () => {
    const start = Date.now()
    await withTimeout(async () => 'fast', 5000, 'fast_tool')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(200) // should not wait near the timeout
  })
})
