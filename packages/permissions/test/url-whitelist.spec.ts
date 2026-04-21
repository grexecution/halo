/**
 * F-042: URL whitelist mode
 */
import { describe, it, expect } from 'vitest'
import { createNetworkMiddleware } from '../src/network.js'

describe('F-042: URL whitelist mode', () => {
  it('allows any URL when whitelist mode is off', () => {
    const mw = createNetworkMiddleware({ urlWhitelistMode: false, allowedUrls: [] })
    expect(mw.checkUrl('https://evil.com/data')).toBe(true)
  })

  it('blocks non-whitelisted URL when mode is on', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: true,
      allowedUrls: ['https://api.anthropic.com'],
    })
    expect(mw.checkUrl('https://evil.com/data')).toBe(false)
  })

  it('allows whitelisted URL when mode is on', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: true,
      allowedUrls: ['https://api.anthropic.com', 'https://api.openai.com'],
    })
    expect(mw.checkUrl('https://api.anthropic.com/v1/messages')).toBe(true)
  })

  it('supports wildcard domain matching', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: true,
      allowedUrls: ['https://*.anthropic.com'],
    })
    expect(mw.checkUrl('https://api.anthropic.com/chat')).toBe(true)
    expect(mw.checkUrl('https://docs.anthropic.com')).toBe(true)
    expect(mw.checkUrl('https://google.com')).toBe(false)
  })
})
