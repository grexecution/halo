/**
 * F-105: Custom MCP add
 */
import { describe, it, expect } from 'vitest'
import { createMcpRegistry, type ConnectorMeta } from '../src/index.js'

describe('F-105: Custom MCP add', () => {
  it('can add a custom MCP by pasting config', () => {
    const registry = createMcpRegistry()
    const customMcp: ConnectorMeta = {
      id: 'my-custom-mcp',
      name: 'FeedBucket',
      type: 'api-key',
      status: 'active',
      tools: ['feedbucket.submit', 'feedbucket.list'],
    }
    registry.register(customMcp)
    expect(registry.isActive('my-custom-mcp')).toBe(true)
    expect(registry.get('my-custom-mcp')?.tools).toContain('feedbucket.submit')
  })

  it('custom MCP appears in registry list', () => {
    const registry = createMcpRegistry()
    registry.register({ id: 'custom-1', name: 'My Tool', type: 'mcp', status: 'active' })
    const list = registry.list()
    expect(list.some((c) => c.id === 'custom-1')).toBe(true)
  })
})
