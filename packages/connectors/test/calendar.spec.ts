/**
 * F-104: Google Calendar connector
 */
import { describe, it, expect } from 'vitest'
import { createMcpRegistry } from '../src/index.js'

describe('F-104: Google Calendar connector', () => {
  it('Calendar MCP registers with read and write event tools', () => {
    const registry = createMcpRegistry()
    registry.register({
      id: 'gcal',
      name: 'Google Calendar',
      type: 'oauth',
      status: 'active',
      tools: ['calendar.listEvents', 'calendar.createEvent', 'calendar.deleteEvent'],
    })
    const meta = registry.get('gcal')
    expect(meta?.tools).toContain('calendar.listEvents')
    expect(meta?.tools).toContain('calendar.createEvent')
  })
})
