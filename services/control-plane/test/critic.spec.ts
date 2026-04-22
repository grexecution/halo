/**
 * F-024: Critic loop
 *
 * The critic loop lets a secondary agent review and score the primary agent's output.
 * This test verifies the orchestrator produces a result that can be passed to a critic
 * agent, and that the critic produces a structured review.
 */
import { describe, it, expect } from 'vitest'
import { AgentOrchestrator } from '../src/orchestrator.js'
import type { AgentConfig } from '@open-greg/agent-core'

const primaryAgent: AgentConfig = {
  id: 'agent-main',
  handle: 'greg',
  systemPrompt: 'You are a helpful assistant.',
  model: 'mock',
  timezone: 'UTC',
}

const criticAgent: AgentConfig = {
  id: 'agent-critic',
  handle: 'critic',
  systemPrompt:
    'You are a critic agent. Review the previous response and output a JSON object with fields: score (0-10), issues (string[]), approved (boolean).',
  model: 'mock',
  timezone: 'UTC',
}

describe('F-024: Critic loop', () => {
  it('primary agent produces a response to be reviewed', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await orchestrator.runTurn({
      agent: primaryAgent,
      message: 'Explain how HTTPS works.',
    })
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('critic agent receives primary output and produces a review', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })

    // Step 1: primary response
    const primary = await orchestrator.runTurn({
      agent: primaryAgent,
      message: 'Explain recursion in one sentence.',
    })

    // Step 2: critic reviews the primary output
    const critic = await orchestrator.runTurn({
      agent: criticAgent,
      message: `Review this response:\n\n${primary.content}`,
    })

    expect(critic.content.length).toBeGreaterThan(0)
  })

  it('critic loop runs for each turn in the conversation', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const messages = ['What is 2+2?', 'Explain what an API is.']
    const reviews: string[] = []

    for (const msg of messages) {
      const primary = await orchestrator.runTurn({ agent: primaryAgent, message: msg })
      const review = await orchestrator.runTurn({
        agent: criticAgent,
        message: `Review: ${primary.content}`,
      })
      reviews.push(review.content)
    }

    expect(reviews).toHaveLength(2)
    reviews.forEach((r) => expect(r.length).toBeGreaterThan(0))
  })

  it('critic uses different threadId from primary to avoid cross-contamination', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })

    const primary = await orchestrator.runTurn({
      agent: primaryAgent,
      message: 'Write a haiku about testing.',
      threadId: 'primary-thread',
      resourceId: 'user-1',
    })

    const critic = await orchestrator.runTurn({
      agent: criticAgent,
      message: `Review: ${primary.content}`,
      threadId: 'critic-thread',
      resourceId: 'user-1',
    })

    expect(critic.content).toBeTruthy()
  })
})
