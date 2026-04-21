/**
 * F-092: Slack bot
 */
import { describe, it, expect } from 'vitest'
import { routeMessage, type RouterConfig } from '../src/index.js'

describe('F-092: Slack bot', () => {
  it('threads route to same session (same chatId preserves context)', () => {
    const config: RouterConfig = {
      agents: { claw: 'agent-1' },
      defaultAgentId: 'agent-1',
    }
    const msg1 = {
      id: 'msg1',
      channel: 'slack' as const,
      chatId: 'thread-42',
      userId: 'u1',
      text: 'Start a task',
      isGroup: false,
      timestamp: new Date().toISOString(),
    }
    const msg2 = {
      id: 'msg2',
      channel: 'slack' as const,
      chatId: 'thread-42',
      userId: 'u1',
      text: 'Continue the task',
      isGroup: false,
      timestamp: new Date().toISOString(),
    }
    const r1 = routeMessage(msg1, config)
    const r2 = routeMessage(msg2, config)
    expect(r1?.message.chatId).toBe(r2?.message.chatId)
    expect(r1?.agentId).toBe(r2?.agentId)
  })

  it('routes @mention correctly in Slack', () => {
    const config: RouterConfig = {
      agents: { claw: 'agent-1', coder: 'agent-coder' },
      defaultAgentId: 'agent-1',
    }
    const msg = {
      id: '1',
      channel: 'slack' as const,
      chatId: 'C123',
      userId: 'u1',
      text: '@coder please review my PR',
      isGroup: true,
      timestamp: new Date().toISOString(),
    }
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-coder')
  })
})
