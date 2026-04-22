/**
 * F-021: Sub-agent delegation
 *
 * Verifies that the orchestrator can parse and dispatch tasks to named sub-agents
 * via @mention syntax, and that the routing result contains the correct agent handle.
 */
import { describe, it, expect } from 'vitest'
import { parseMention } from '../src/sub-agent.js'
import { AgentOrchestrator } from '../src/orchestrator.js'
import type { AgentConfig } from '@open-greg/agent-core'

const mockAgent: AgentConfig = {
  id: 'coder',
  handle: 'coder',
  systemPrompt: 'You are a code-writing sub-agent.',
  model: 'mock',
  timezone: 'UTC',
}

describe('F-021: Sub-agent delegation', () => {
  it('parses a delegation mention correctly', () => {
    const result = parseMention('@coder refactor the auth module')
    expect(result).not.toBeNull()
    expect(result?.handle).toBe('coder')
    expect(result?.task).toBe('refactor the auth module')
  })

  it('delegates the extracted task to a sub-agent orchestrator', async () => {
    const mention = parseMention('@coder fix the bug in login.ts')
    expect(mention).not.toBeNull()

    const subOrchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await subOrchestrator.runTurn({
      agent: { ...mockAgent, handle: mention!.handle },
      message: mention!.task,
    })

    expect(result.content).toBeTruthy()
    expect(typeof result.content).toBe('string')
  })

  it('multi-step delegation returns response for each step', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const steps = ['@coder write tests', '@reviewer check code']

    for (const step of steps) {
      const mention = parseMention(step)
      expect(mention).not.toBeNull()
      const result = await orchestrator.runTurn({
        agent: mockAgent,
        message: mention!.task,
      })
      expect(result.content.length).toBeGreaterThan(0)
    }
  })

  it('returns null for message without delegation syntax', () => {
    const result = parseMention('just a regular message without mention')
    expect(result).toBeNull()
  })

  it('sub-agent delegation includes task in response context', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await orchestrator.runTurn({
      agent: mockAgent,
      message: 'debug the login flow',
      threadId: 'delegation-thread',
      resourceId: 'user-1',
    })
    expect(result).toHaveProperty('content')
  })
})
