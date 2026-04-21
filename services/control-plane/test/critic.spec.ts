/**
 * F-024: Critic loop
 */
import { describe, it, expect } from 'vitest'
import { CriticLoop } from '../src/critic.js'

describe('F-024: Critic loop', () => {
  it('approves a satisfactory result on first pass', async () => {
    const critic = new CriticLoop({ dryRun: true, alwaysApprove: true })
    const result = await critic.review({
      task: 'Write a hello world function',
      output: 'function hello() { return "Hello, World!" }',
    })
    expect(result.approved).toBe(true)
    expect(result.iterations).toBe(1)
  })

  it('requests revision for a poor result (dryRun revise mode)', async () => {
    const critic = new CriticLoop({ dryRun: true, alwaysApprove: false })
    const result = await critic.review({
      task: 'Write a hello world function',
      output: 'TODO: implement this',
    })
    expect(result.approved).toBe(true)
    expect(result.iterations).toBeGreaterThan(1)
  })

  it('caps iterations at maxIterations', async () => {
    const critic = new CriticLoop({ dryRun: true, alwaysApprove: false, maxIterations: 2 })
    const result = await critic.review({
      task: 'Write a complex algorithm',
      output: 'incomplete draft',
    })
    expect(result.iterations).toBeLessThanOrEqual(2)
  })
})
