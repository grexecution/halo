/**
 * F-061: Browser agent mode (headless + vision)
 */
import { describe, it, expect } from 'vitest'
import { BrowserService } from '../src/index.js'

describe('F-061: Browser agent mode', () => {
  it('returns success result for a goal', async () => {
    const browser = new BrowserService({ dryRun: true })
    const result = await browser.act('fill and submit test form')
    expect(result.success).toBe(true)
  })

  it('reports number of steps taken', async () => {
    const browser = new BrowserService({ dryRun: true })
    const result = await browser.act('click login button')
    expect(result.steps).toBeGreaterThanOrEqual(1)
  })
})
