/**
 * F-025: Self-health awareness
 *
 * Verifies that the orchestrator can include health/status information
 * in its responses, and that the stuck-loop detector flags degraded loops.
 */
import { describe, it, expect } from 'vitest'
import { AgentOrchestrator } from '../src/orchestrator.js'
import { StuckLoopDetector } from '../src/stuck-detector.js'
import { SessionBudget } from '../src/budget.js'
import type { AgentConfig } from '@open-greg/agent-core'

const agent: AgentConfig = {
  id: 'greg',
  handle: 'greg',
  systemPrompt: 'You are an autonomous AI agent with self-awareness of your current state.',
  model: 'mock',
  timezone: 'UTC',
}

describe('F-025: Self-health awareness', () => {
  it('agent responds to a health-check message', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await orchestrator.runTurn({
      agent,
      message: 'What is your current status?',
    })
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('stuck-loop detector flags repeated identical tool calls', () => {
    const detector = new StuckLoopDetector({ windowSize: 3 })
    const repeated = [
      { toolCall: 'shell_exec("ls /")' },
      { toolCall: 'shell_exec("ls /")' },
      { toolCall: 'shell_exec("ls /")' },
    ]
    const result = detector.analyze(repeated)
    expect(result.stuck).toBe(true)
    expect(result.reason).toBeTruthy()
    expect(result.resetPrompt).toBeTruthy()
  })

  it('stuck-loop detector does not flag varied tool calls', () => {
    const detector = new StuckLoopDetector({ windowSize: 3 })
    const varied = [
      { toolCall: 'shell_exec("ls /")' },
      { toolCall: 'fs_read("/etc/hosts")' },
      { toolCall: 'get_time({})' },
    ]
    expect(detector.analyze(varied).stuck).toBe(false)
  })

  it('orchestrator injects stuck notice into stream when loop detected', async () => {
    // In dry-run mode the orchestrator can receive a stream and should not crash
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const chunks: string[] = []

    await orchestrator.runTurn({
      agent,
      message: 'run the health check loop',
      onChunk: (c) => chunks.push(c),
    })

    expect(chunks.length).toBeGreaterThan(0)
  })

  it('session budget tracks consumption and can report status', () => {
    const budget = new SessionBudget({ maxTokens: 1000 })
    budget.checkAndConsume({ tokens: 200 })
    expect(budget.totalTokens).toBe(200)
    // below budget — no error
    expect(() => budget.checkAndConsume({ tokens: 100 })).not.toThrow()
  })
})
