/**
 * F-112: Notification routing
 *
 * Verifies that agent output can be routed as a notification to the right
 * channel (Telegram/Discord/Slack) based on the routing configuration.
 * Uses the messaging package's routeMessage + mock adapter.
 */
import { describe, it, expect } from 'vitest'
import {
  routeMessage,
  createMockAdapter,
  type RouterConfig,
  type IncomingMessage,
} from '@open-greg/messaging'

const config: RouterConfig = {
  agents: { coder: 'agent-coder', reviewer: 'agent-reviewer' },
  defaultAgentId: 'agent-main',
}

function makeMsg(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: crypto.randomUUID(),
    channel: 'telegram',
    chatId: 'chat-123',
    userId: 'user-1',
    text: 'test message',
    isGroup: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('F-112: Notification routing', () => {
  it('routes a notification to the default agent for a direct message', () => {
    const msg = makeMsg({ isGroup: false, text: 'any plain message' })
    const routed = routeMessage(msg, config)
    expect(routed).not.toBeNull()
    expect(routed?.agentId).toBe('agent-main')
    expect(routed?.reason).toBe('direct')
  })

  it('routes a notification via @mention to the correct agent', () => {
    const msg = makeMsg({ isGroup: true, text: '@coder run linter' })
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-coder')
    expect(routed?.reason).toBe('mention')
  })

  it('routes from Telegram channel', () => {
    const msg = makeMsg({ channel: 'telegram', isGroup: false, text: 'telegram notification' })
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-main')
  })

  it('routes from Discord channel', () => {
    const msg = makeMsg({ channel: 'discord', isGroup: false, text: 'discord notification' })
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-main')
  })

  it('routes from Slack channel', () => {
    const msg = makeMsg({ channel: 'slack', isGroup: false, text: 'slack notification' })
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-main')
  })

  it('mock adapter delivers a notification message', async () => {
    const adapter = createMockAdapter() as ReturnType<typeof createMockAdapter> & {
      _sent: Array<{ chatId: string; text: string }>
    }

    await adapter.send({ chatId: 'chat-123', text: 'Goal completed: weekly summary done.' })
    expect((adapter as { _sent: Array<{ chatId: string; text: string }> })._sent).toHaveLength(1)
    expect(
      (adapter as { _sent: Array<{ chatId: string; text: string }> })._sent[0]?.text,
    ).toContain('Goal completed')
  })

  it('mock adapter triggers registered message handler', async () => {
    const adapter = createMockAdapter() as ReturnType<typeof createMockAdapter> & {
      _trigger: (msg: IncomingMessage) => Promise<void>
    }

    const received: IncomingMessage[] = []
    adapter.onMessage(async (msg) => {
      received.push(msg)
    })

    await (adapter as { _trigger: (msg: IncomingMessage) => Promise<void> })._trigger(
      makeMsg({ text: 'incoming notification' }),
    )
    expect(received).toHaveLength(1)
    expect(received[0]?.text).toBe('incoming notification')
  })
})
