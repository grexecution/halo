/**
 * F-060: Browser scraping mode
 */
import { describe, it, expect } from 'vitest'
import { BrowserService } from '../src/index.js'

describe('F-060: Browser scraping mode', () => {
  it('returns text content for a URL', async () => {
    const browser = new BrowserService({ dryRun: true })
    const result = await browser.scrape('https://example.com')
    expect(result.url).toBe('https://example.com')
    expect(result.text).toBeTruthy()
  })

  it('includes title in scrape result', async () => {
    const browser = new BrowserService({ dryRun: true })
    const result = await browser.scrape('https://example.com')
    expect(result.title).toBeTruthy()
  })

  it('accepts optional selector parameter', async () => {
    const browser = new BrowserService({ dryRun: true })
    const result = await browser.scrape('https://example.com', 'h1')
    expect(result.url).toBe('https://example.com')
  })
})
