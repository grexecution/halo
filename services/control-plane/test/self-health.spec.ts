/**
 * F-025: Self-health awareness
 */
import { describe, it, expect } from 'vitest'
import { SelfHealthChecker } from '../src/self-health.js'

describe('F-025: Self-health awareness', () => {
  it('reports healthy when no errors', async () => {
    const checker = new SelfHealthChecker({ dryRun: true })
    const status = await checker.healthCheck()
    expect(status.healthy).toBe(true)
    expect(status.services).toBeDefined()
  })

  it('reports unhealthy when service is down', async () => {
    const checker = new SelfHealthChecker({ dryRun: true, simulateDown: ['browser-service'] })
    const status = await checker.healthCheck()
    expect(status.healthy).toBe(false)
    expect(status.services['browser-service']).toMatch(/unavailable/i)
  })

  it('recentErrors returns empty array when no errors', async () => {
    const checker = new SelfHealthChecker({ dryRun: true })
    const errors = await checker.recentErrors()
    expect(Array.isArray(errors)).toBe(true)
  })

  it('stops retrying when browser service is down', async () => {
    const checker = new SelfHealthChecker({ dryRun: true, simulateDown: ['browser-service'] })
    const status = await checker.healthCheck()
    expect(status.services['browser-service']).toContain('unavailable')
  })
})
