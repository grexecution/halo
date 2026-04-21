/**
 * F-100: MCP client registry
 */
import { describe, it, expect } from 'vitest'
import { createMcpRegistry } from '../src/index.js'

describe('F-100: MCP client registry', () => {
  it('registers and lists MCPs', () => {
    const registry = createMcpRegistry()
    registry.register({
      id: 'gmail',
      name: 'Gmail',
      type: 'oauth',
      status: 'active',
      tools: ['gmail.list', 'gmail.send'],
    })
    const list = registry.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('gmail')
  })

  it('can unregister an MCP', () => {
    const registry = createMcpRegistry()
    registry.register({ id: 'github', name: 'GitHub', type: 'oauth', status: 'active' })
    registry.unregister('github')
    expect(registry.list()).toHaveLength(0)
  })

  it('isActive returns true only for active MCPs', () => {
    const registry = createMcpRegistry()
    registry.register({ id: 'slack', name: 'Slack', type: 'oauth', status: 'active' })
    registry.register({ id: 'broken', name: 'Broken', type: 'api-key', status: 'error' })
    expect(registry.isActive('slack')).toBe(true)
    expect(registry.isActive('broken')).toBe(false)
  })

  it('tools become callable after registration', () => {
    const registry = createMcpRegistry()
    registry.register({
      id: 'calendar',
      name: 'Calendar',
      type: 'oauth',
      status: 'active',
      tools: ['calendar.list', 'calendar.create'],
    })
    const meta = registry.get('calendar')
    expect(meta?.tools).toContain('calendar.list')
  })
})
