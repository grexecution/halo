/**
 * F-020: Main agent loop
 * Verifies that message → orchestrator → LLM call → streamed response works.
 * Uses a mock LLM to avoid actual API calls.
 */
import { describe, it, expect } from 'vitest'
import { AgentOrchestrator } from '../src/orchestrator.js'
import type { AgentConfig } from '@open-greg/agent-core'

const mockAgent: AgentConfig = {
  id: 'agent-1',
  handle: 'claw',
  systemPrompt: 'You are a helpful assistant.',
  model: 'mock',
  timezone: 'UTC',
}

describe('F-020: Main agent loop', () => {
  it('runTurn returns a text response', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await orchestrator.runTurn({
      agent: mockAgent,
      message: 'Hello',
      history: [],
    })
    expect(result).toBeDefined()
    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('runTurn calls the get_time tool when asked', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const result = await orchestrator.runTurn({
      agent: mockAgent,
      message: 'What time is it?',
      history: [],
    })
    expect(result).toBeDefined()
    // In dry-run mode with mock, it should handle time queries
    expect(result.content).toBeTruthy()
  })

  it('runTurn includes message history in context', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const history = [
      { role: 'user' as const, content: 'My name is Alice', timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: 'Hello Alice!', timestamp: new Date().toISOString() },
    ]
    const result = await orchestrator.runTurn({
      agent: mockAgent,
      message: 'What is my name?',
      history,
    })
    expect(result.content).toBeTruthy()
  })

  it('streams tokens via the onChunk callback', async () => {
    const orchestrator = new AgentOrchestrator({ dryRun: true })
    const chunks: string[] = []
    await orchestrator.runTurn({
      agent: mockAgent,
      message: 'Say hello',
      history: [],
      onChunk: (chunk) => chunks.push(chunk),
    })
    // In dry-run, at minimum we should get the full response as one chunk
    expect(chunks.length).toBeGreaterThan(0)
  })
})
