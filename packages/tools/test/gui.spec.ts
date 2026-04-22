/**
 * F-052: Desktop GUI (computer-use)
 * Anthropic computer-use tool, permission-gated.
 */
import { describe, it, expect } from 'vitest'
import { computerUseTool } from '../src/gui.js'
import { createMiddleware } from '@open-greg/permissions'

describe('F-052: Desktop GUI (computer-use)', () => {
  it('tool is registered with correct ID', () => {
    expect(computerUseTool.id).toBe('computer_use')
  })

  it('denies when permission not granted', async () => {
    const mw = createMiddleware({ tools: { computer_use: { allow: false } } })
    await expect(
      computerUseTool.run(
        { action: 'screenshot' },
        {
          sessionId: 's1',
          agentId: 'a1',
          middleware: mw,
        },
      ),
    ).rejects.toThrow(/denied/i)
  })

  it('allows screenshot when permission granted', async () => {
    const mw = createMiddleware({ tools: { computer_use: { allow: true } } })
    const result = await computerUseTool.run(
      { action: 'screenshot' },
      {
        sessionId: 's1',
        agentId: 'a1',
        middleware: mw,
      },
    )
    expect(result).toBeDefined()
    expect(result.action).toBe('screenshot')
  })
})
