/**
 * F-021: Sub-agent delegation
 */
import { describe, it, expect } from 'vitest'
import { SubAgentOrchestrator } from '../src/sub-agent.js'

describe('F-021: Sub-agent delegation', () => {
  it('delegate() spawns a sub-agent session and returns result', async () => {
    const orchestrator = new SubAgentOrchestrator({ dryRun: true })
    const result = await orchestrator.delegate({
      handle: 'coder',
      task: 'Write a hello world function',
      parentSessionId: 'sess-1',
    })
    expect(result).toBeDefined()
    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.subSessionId).toBeDefined()
  })

  it('sub-agent result is integrated into parent context', async () => {
    const orchestrator = new SubAgentOrchestrator({ dryRun: true })
    const result = await orchestrator.delegate({
      handle: 'coder',
      task: 'Generate a function',
      parentSessionId: 'sess-parent',
    })
    expect(result.subSessionId).not.toBe('sess-parent')
  })

  it('tool call is visible as a tool block', async () => {
    const orchestrator = new SubAgentOrchestrator({ dryRun: true })
    const result = await orchestrator.delegate({
      handle: 'reviewer',
      task: 'Review this code',
      parentSessionId: 'sess-1',
    })
    expect(result.toolCallBlock).toBeDefined()
    expect(result.toolCallBlock?.toolId).toBe('delegate')
  })
})
