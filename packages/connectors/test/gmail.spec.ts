/**
 * F-102: Gmail connector
 */
import { describe, it, expect } from 'vitest'
import { createMcpRegistry } from '../src/index.js'

describe('F-102: Gmail connector', () => {
  it('Gmail MCP registers with read and send tools', () => {
    const registry = createMcpRegistry()
    registry.register({
      id: 'gmail',
      name: 'Gmail',
      type: 'oauth',
      status: 'active',
      tools: ['gmail.listUnread', 'gmail.send', 'gmail.reply'],
    })
    const meta = registry.get('gmail')
    expect(meta?.tools).toContain('gmail.listUnread')
    expect(meta?.tools).toContain('gmail.send')
  })

  it('Gmail connector is listable in registry', () => {
    const registry = createMcpRegistry()
    registry.register({ id: 'gmail', name: 'Gmail', type: 'oauth', status: 'active' })
    const list = registry.list()
    const gmail = list.find((c) => c.id === 'gmail')
    expect(gmail).toBeDefined()
    expect(gmail?.name).toBe('Gmail')
  })
})
