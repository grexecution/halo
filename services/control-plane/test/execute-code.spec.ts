/**
 * F-206: execute_code tool
 *
 * Verifies that the execute_code tool runs JS snippets in a VM sandbox
 * and correctly captures stdout, respects timeouts, and checks permissions.
 */
import { describe, it, expect } from 'vitest'
import { executeCodeTool } from '../src/execute-code.js'

describe('F-206: execute_code tool', () => {
  it('executes a simple expression and returns the result', async () => {
    const result = await executeCodeTool.execute({ code: '1 + 1', timeout: 5000 }, {} as never)
    expect(result.ok).toBe(true)
    expect(result.result).toBe(2)
  })

  it('captures console.log output', async () => {
    const result = await executeCodeTool.execute(
      { code: 'console.log("hello from vm")', timeout: 5000 },
      {} as never,
    )
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('hello from vm')
  })

  it('captures the last expression value as result', async () => {
    const result = await executeCodeTool.execute(
      { code: 'const x = 42; x * 2', timeout: 5000 },
      {} as never,
    )
    expect(result.ok).toBe(true)
    expect(result.result).toBe(84)
  })

  it('returns error info on syntax error without throwing', async () => {
    const result = await executeCodeTool.execute(
      { code: 'const = broken syntax !!!', timeout: 5000 },
      {} as never,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns error info on runtime error without throwing', async () => {
    const result = await executeCodeTool.execute(
      { code: 'throw new Error("intentional error")', timeout: 5000 },
      {} as never,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('intentional error')
  })

  it('enforces the timeout and returns a timeout error', async () => {
    const result = await executeCodeTool.execute(
      {
        code: `
          // Busy loop — will be killed by timeout
          const start = Date.now()
          while (Date.now() - start < 10000) { /* spin */ }
        `,
        timeout: 50, // 50ms
      },
      {} as never,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/timeout|timed out/i)
  }, 10000)

  it('runs in an isolated context — no access to process.env', async () => {
    const result = await executeCodeTool.execute(
      { code: 'typeof process', timeout: 5000 },
      {} as never,
    )
    expect(result.ok).toBe(true)
    // In the sandbox, process is not available
    expect(result.result).toBe('undefined')
  })

  it('supports multi-line code with variable binding', async () => {
    const code = `
      const nums = [1, 2, 3, 4, 5]
      const sum = nums.reduce((a, b) => a + b, 0)
      sum
    `
    const result = await executeCodeTool.execute({ code, timeout: 5000 }, {} as never)
    expect(result.ok).toBe(true)
    expect(result.result).toBe(15)
  })

  it('is exported in allMastraTools', async () => {
    const { allMastraTools } = await import('../src/mastra-tools.js')
    expect(allMastraTools).toHaveProperty('execute_code')
  })
})
