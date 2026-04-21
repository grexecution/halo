/**
 * F-023: Telegram group-chat routing
 */
import { describe, it, expect } from 'vitest'
import { routeMessage, type RouterConfig } from '../src/index.js'

describe('F-023: Telegram group-chat routing', () => {
  const config: RouterConfig = {
    agents: { claw: 'agent-main', coder: 'agent-coder', reviewer: 'agent-reviewer' },
    defaultAgentId: 'agent-main',
  }

  it('routes @coder mention to coder sub-agent', () => {
    const msg = {
      id: '1',
      channel: 'telegram' as const,
      chatId: 'group-1',
      userId: 'u1',
      text: '@coder fix this import',
      isGroup: true,
      timestamp: new Date().toISOString(),
    }
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-coder')
    expect(routed?.reason).toBe('mention')
  })

  it('routes @reviewer mention to reviewer sub-agent', () => {
    const msg = {
      id: '2',
      channel: 'telegram' as const,
      chatId: 'group-1',
      userId: 'u1',
      text: '@reviewer please check my work',
      isGroup: true,
      timestamp: new Date().toISOString(),
    }
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-reviewer')
  })

  it('returns null for group message to unknown handle', () => {
    const noDefaultConfig: RouterConfig = { agents: { claw: 'agent-main' } }
    const msg = {
      id: '3',
      channel: 'telegram' as const,
      chatId: 'group-1',
      userId: 'u1',
      text: '@unknown do something',
      isGroup: true,
      timestamp: new Date().toISOString(),
    }
    const noDefault = routeMessage(msg, noDefaultConfig)
    expect(noDefault).toBeNull()
  })

  it('no cross-talk: three-way conversation stays isolated', () => {
    const msg1 = {
      id: '1',
      channel: 'telegram' as const,
      chatId: 'g1',
      userId: 'u1',
      text: '@coder task1',
      isGroup: true,
      timestamp: '',
    }
    const msg2 = {
      id: '2',
      channel: 'telegram' as const,
      chatId: 'g1',
      userId: 'u2',
      text: '@reviewer task2',
      isGroup: true,
      timestamp: '',
    }
    const r1 = routeMessage(msg1, config)
    const r2 = routeMessage(msg2, config)
    expect(r1?.agentId).not.toBe(r2?.agentId)
  })
})
