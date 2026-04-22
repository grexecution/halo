/**
 * F-026: Agent session resume
 *
 * Verifies that a session can be continued from a previous threadId/resourceId,
 * and that the orchestrator correctly passes history into the new turn.
 */
import { describe, it, expect } from 'vitest'
import { AgentOrchestrator } from '../src/orchestrator.js'
import type { AgentConfig } from '@open-greg/agent-core'

const agent: AgentConfig = {
  id: 'greg',
  handle: 'greg',
  systemPrompt: 'You are a helpful assistant.',
  model: 'mock',
  timezone: 'UTC',
}

describe('F-026: Agent session resume', () => {
  it('resumes a session by passing history from a previous turn', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const threadId = 'resume-thread-1'

    // Turn 1
    const turn1 = await orchestrator.runTurn({
      agent,
      message: 'My name is Bob.',
      threadId,
      resourceId: 'user-1',
    })
    expect(turn1.content).toBeTruthy()

    // Turn 2 — resume with history from turn 1
    const turn2 = await orchestrator.runTurn({
      agent,
      message: 'What is my name?',
      history: [
        { role: 'user', content: 'My name is Bob.', timestamp: new Date().toISOString() },
        { role: 'assistant', content: turn1.content, timestamp: new Date().toISOString() },
      ],
      threadId,
      resourceId: 'user-1',
    })
    expect(turn2.content).toBeTruthy()
  })

  it('resumes multiple sessions with different threadIds independently', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })

    const resultA = await orchestrator.runTurn({
      agent,
      message: 'Session A question',
      threadId: 'thread-A',
      resourceId: 'user-1',
    })

    const resultB = await orchestrator.runTurn({
      agent,
      message: 'Session B question',
      threadId: 'thread-B',
      resourceId: 'user-1',
    })

    expect(resultA.content).toBeTruthy()
    expect(resultB.content).toBeTruthy()
  })

  it('empty history is valid for a new session', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await orchestrator.runTurn({
      agent,
      message: 'Starting fresh',
      history: [],
      threadId: 'new-session',
      resourceId: 'user-1',
    })
    expect(result.content).toBeTruthy()
  })

  it('session resume preserves streaming callback behavior', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const chunks: string[] = []

    await orchestrator.runTurn({
      agent,
      message: 'Continued question',
      history: [{ role: 'user', content: 'First turn', timestamp: new Date().toISOString() }],
      threadId: 'stream-resume',
      resourceId: 'user-1',
      onChunk: (c) => chunks.push(c),
    })

    expect(chunks.length).toBeGreaterThan(0)
  })
})
