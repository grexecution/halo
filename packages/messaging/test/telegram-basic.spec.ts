/**
 * F-090: Telegram bot basic
 */
import { describe, it, expect } from 'vitest'
import { createMockAdapter, routeMessage, type RouterConfig } from '../src/index.js'

describe('F-090: Telegram bot basic', () => {
  it('mock adapter can send a message', async () => {
    const bot = createMockAdapter()
    await bot.send({ chatId: '123', text: 'Hello!' })
    const adapter = bot as unknown as { _sent: Array<{ chatId: string; text: string }> }
    expect(adapter._sent).toHaveLength(1)
    expect(adapter._sent[0]?.text).toBe('Hello!')
  })

  it('routes a DM to the default agent', () => {
    const config: RouterConfig = {
      agents: { claw: 'agent-1' },
      defaultAgentId: 'agent-1',
    }
    const msg = {
      id: '1',
      channel: 'telegram' as const,
      chatId: '123',
      userId: 'u1',
      text: 'What time is it?',
      isGroup: false,
      timestamp: new Date().toISOString(),
    }
    const routed = routeMessage(msg, config)
    expect(routed).not.toBeNull()
    expect(routed?.agentId).toBe('agent-1')
    expect(routed?.reason).toBe('direct')
  })

  it('can register message handler', async () => {
    const bot = createMockAdapter()
    let received = false
    bot.onMessage(async () => {
      received = true
    })
    const adapter = bot as unknown as { _trigger: (m: object) => Promise<void> }
    await adapter._trigger({
      id: '1',
      channel: 'telegram',
      chatId: '123',
      userId: 'u1',
      text: 'hi',
      timestamp: '',
    })
    expect(received).toBe(true)
  })
})
