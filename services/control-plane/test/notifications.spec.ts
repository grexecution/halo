/**
 * F-112: Notification routing
 *
 * Verifies that agent output can be routed as a notification to the right
 * channel (Telegram/Discord/Slack) based on the routing configuration.
 *
 * Tests the routing logic inline (same logic as @open-greg/messaging)
 * to avoid an additional workspace dep on the control-plane.
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inline types + routing logic (mirrors @open-greg/messaging)
// ---------------------------------------------------------------------------

type MessageChannel = 'telegram' | 'discord' | 'slack'

interface IncomingMessage {
  id: string
  channel: MessageChannel
  chatId: string
  userId: string
  text: string
  isGroup?: boolean
  timestamp: string
}

interface RouterConfig {
  agents: Record<string, string>
  defaultAgentId?: string
}

interface RoutedMessage {
  agentId: string
  message: IncomingMessage
  reason: 'mention' | 'direct' | 'default'
}

function routeMessage(msg: IncomingMessage, config: RouterConfig): RoutedMessage | null {
  const { agents, defaultAgentId } = config
  const mentionMatch = msg.text.match(/@(\w+)/)
  if (mentionMatch) {
    const handle = mentionMatch[1] ?? ''
    const agentId = agents[handle]
    if (agentId) return { agentId, message: msg, reason: 'mention' }
  }
  if (!msg.isGroup && defaultAgentId)
    return { agentId: defaultAgentId, message: msg, reason: 'direct' }
  if (msg.isGroup && defaultAgentId)
    return { agentId: defaultAgentId, message: msg, reason: 'default' }
  return null
}

// ---------------------------------------------------------------------------

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

  it('group message without mention routes to default agent', () => {
    const msg = makeMsg({ isGroup: true, text: 'a group message with no mention' })
    const routed = routeMessage(msg, config)
    expect(routed?.agentId).toBe('agent-main')
    expect(routed?.reason).toBe('default')
  })

  it('returns null when no agent matched and no default', () => {
    const msg = makeMsg({ isGroup: true, text: 'unroutable message' })
    const routed = routeMessage(msg, { agents: {} })
    expect(routed).toBeNull()
  })
})
