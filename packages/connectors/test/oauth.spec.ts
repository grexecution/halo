/**
 * F-101: OAuth flow framework
 */
import { describe, it, expect } from 'vitest'
import { createOAuthFlow, type OAuthConfig } from '../src/index.js'

const testConfig: OAuthConfig = {
  connectorId: 'test-oauth',
  clientId: 'test-client',
  scopes: ['read', 'write'],
  authUrl: 'https://auth.example.com/authorize',
  tokenUrl: 'https://auth.example.com/token',
  redirectUri: 'http://localhost:3000/oauth/callback/test-oauth',
}

describe('F-101: OAuth flow framework', () => {
  it('generates an auth URL with correct parameters', () => {
    const flow = createOAuthFlow(testConfig)
    const url = flow.getAuthUrl('random-state-123')
    expect(url).toContain('auth.example.com/authorize')
    expect(url).toContain('client_id=test-client')
    expect(url).toContain('scope=read+write')
    expect(url).toContain('state=random-state-123')
    expect(url).toContain('response_type=code')
  })

  it('includes redirect_uri in auth URL', () => {
    const flow = createOAuthFlow(testConfig)
    const url = flow.getAuthUrl('state')
    expect(url).toContain('redirect_uri=')
  })

  it('getAuthUrl uses the configured authUrl as base', () => {
    const flow = createOAuthFlow(testConfig)
    const url = flow.getAuthUrl('s')
    expect(url.startsWith('https://auth.example.com/authorize')).toBe(true)
  })
})
