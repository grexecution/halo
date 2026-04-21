/**
 * F-167: Security regression suite — network
 */
import { describe, it, expect } from 'vitest'
import { createNetworkMiddleware } from '../../packages/permissions/src/network.js'

describe('F-167: Security regression — URL whitelist', () => {
  it('URL whitelist blocks non-whitelisted URLs', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: true,
      allowedUrls: ['https://api.anthropic.com'],
    })
    expect(mw.checkUrl('https://evil.com/exfiltrate')).toBe(false)
    expect(mw.checkUrl('https://malicious.io')).toBe(false)
  })

  it('URL whitelist allows explicitly listed domains', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: true,
      allowedUrls: ['https://api.anthropic.com', 'https://api.openai.com'],
    })
    expect(mw.checkUrl('https://api.anthropic.com/v1/messages')).toBe(true)
    expect(mw.checkUrl('https://api.openai.com/v1/chat')).toBe(true)
  })

  it('wildcard entries block non-matching subdomains', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: true,
      allowedUrls: ['https://*.anthropic.com'],
    })
    expect(mw.checkUrl('https://api.anthropic.com/chat')).toBe(true)
    expect(mw.checkUrl('https://notanthopic.com')).toBe(false)
    expect(mw.checkUrl('https://anthropic.com.evil.io')).toBe(false)
  })

  it('disabling whitelist mode allows any URL', () => {
    const mw = createNetworkMiddleware({
      urlWhitelistMode: false,
      allowedUrls: [],
    })
    expect(mw.checkUrl('https://anywhere.io')).toBe(true)
  })
})
