/**
 * F-167: Security regression suite — all security invariants in one file
 */
import { describe, it, expect } from 'vitest'
import { createMiddleware, type PermissionConfig } from '../../packages/permissions/src/index.js'
import { createNetworkMiddleware } from '../../packages/permissions/src/network.js'

describe('F-167: Security regression — permissions', () => {
  it('denied paths stay denied even when tool is explicitly listed', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: false } },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'ls' }, { userId: 'u1' })
    expect(result.decision).toBe('deny')
  })

  it('wildcard deny blocks all tools', async () => {
    const config: PermissionConfig = {
      tools: { '*': { allow: false } },
    }
    const mw = createMiddleware(config)
    const r1 = await mw.check('shell_exec', {}, {})
    const r2 = await mw.check('fs.read', {}, {})
    const r3 = await mw.check('browser.act', {}, {})
    expect(r1.decision).toBe('deny')
    expect(r2.decision).toBe('deny')
    expect(r3.decision).toBe('deny')
  })

  it('sudo toggle actually blocks sudo commands', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: false },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'sudo rm -rf /etc' }, { userId: 'u1' })
    expect(result.decision).toBe('deny')
    expect(result.reason).toMatch(/sudo/i)
  })

  it('sudo enabled allows sudo commands', async () => {
    const config: PermissionConfig = {
      tools: { shell_exec: { allow: true } },
      filesystem: { sudo: true },
    }
    const mw = createMiddleware(config)
    const result = await mw.check('shell_exec', { cmd: 'sudo apt-get update' }, { userId: 'u1' })
    expect(result.decision).toBe('allow')
  })

  it('no tool config means allow by default', async () => {
    const config: PermissionConfig = {}
    const mw = createMiddleware(config)
    const result = await mw.check('any_tool', {}, {})
    expect(result.decision).toBe('allow')
  })
})

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
