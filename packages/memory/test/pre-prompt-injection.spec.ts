/**
 * F-031: Pre-prompt memory injection
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ChatIndexing, PrePromptInjection } from '../src/index.js'

describe('F-031: Pre-prompt memory injection', () => {
  let chat: ChatIndexing
  let ppi: PrePromptInjection

  beforeEach(() => {
    chat = new ChatIndexing()
    ppi = new PrePromptInjection(chat)
  })

  it('returns empty string when memory is empty', () => {
    const result = ppi.inject('any message')
    expect(result).toBe('')
  })

  it('returns relevant context for a matching query', () => {
    chat.index({
      id: '1',
      role: 'user',
      content: 'deploy to production',
      timestamp: new Date().toISOString(),
    })
    const result = ppi.inject('deploy')
    expect(result).toContain('deploy to production')
    expect(result).toContain('## Relevant context from memory')
  })

  it('does not return unrelated messages', () => {
    chat.index({
      id: '1',
      role: 'user',
      content: 'the weather is nice',
      timestamp: new Date().toISOString(),
    })
    const result = ppi.inject('deploy')
    expect(result).toBe('')
  })

  it('limits the number of injected messages', () => {
    for (let i = 0; i < 20; i++) {
      chat.index({
        id: String(i),
        role: 'user',
        content: `deploy step ${i}`,
        timestamp: new Date().toISOString(),
      })
    }
    const result = ppi.inject('deploy', 3)
    // There should be at most 3 lines of context
    const lines = result.split('\n').filter((l) => l.startsWith('['))
    expect(lines.length).toBeLessThanOrEqual(3)
  })

  it('includes role and timestamp in the injected context', () => {
    const ts = '2024-01-01T00:00:00.000Z'
    chat.index({ id: '42', role: 'assistant', content: 'remember this', timestamp: ts })
    const result = ppi.inject('remember')
    expect(result).toContain('assistant')
    expect(result).toContain(ts)
  })
})
