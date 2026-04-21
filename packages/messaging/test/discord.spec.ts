/**
 * F-091: Discord bot
 */
import { describe, it, expect } from 'vitest'
import { routeMessage, type RouterConfig } from '../src/index.js'

describe('F-091: Discord bot', () => {
  it('routes /coder slash command to coder agent', () => {
    const config: RouterConfig = {
      agents: { coder: 'agent-coder', claw: 'agent-main' },
      defaultAgentId: 'agent-main',
    }
    const msg = {
      id: '1',
      channel: 'discord' as const,
      chatId: 'ch1',
      userId: 'u1',
      text: '@coder fix this bug',
      isGroup: true,
      timestamp: new Date().toISOString(),
    }
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-coder')
    expect(routed?.reason).toBe('mention')
  })

  it('routes to default agent when no mention in channel', () => {
    const config: RouterConfig = {
      agents: { coder: 'agent-coder' },
      defaultAgentId: 'agent-main',
    }
    const msg = {
      id: '1',
      channel: 'discord' as const,
      chatId: 'ch1',
      userId: 'u1',
      text: 'hello everyone',
      isGroup: true,
      timestamp: new Date().toISOString(),
    }
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-main')
  })
})
