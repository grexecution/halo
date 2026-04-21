/**
 * F-062: Persistent browser profile
 */
import { describe, it, expect } from 'vitest'
import { BrowserService } from '../src/index.js'

describe('F-062: Persistent browser profile', () => {
  it('returns a profile URL when persistent flag is set', async () => {
    const browser = new BrowserService({ dryRun: true, profileDir: '/tmp/test-profile' })
    const result = await browser.act('log in to dashboard', { persistent: true })
    expect(result.finalUrl).toMatch(/^profile:/)
  })

  it('includes the profile directory in the finalUrl', async () => {
    const browser = new BrowserService({ dryRun: true, profileDir: '/tmp/test-profile' })
    const result = await browser.act('check inbox', { persistent: true })
    expect(result.finalUrl).toContain('/tmp/test-profile')
  })

  it('non-persistent act does not return a finalUrl', async () => {
    const browser = new BrowserService({ dryRun: true, profileDir: '/tmp/test-profile' })
    const result = await browser.act('click button')
    expect(result.finalUrl).toBeUndefined()
  })
})
