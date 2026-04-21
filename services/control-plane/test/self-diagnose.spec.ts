/**
 * F-122: Agent self-diagnose
 */
import { describe, it, expect } from 'vitest'
import { SelfDiagnoseTools } from '../src/self-diagnose.js'

describe('F-122: Agent self-diagnose', () => {
  it('health_check reports all services up when healthy', async () => {
    const tools = new SelfDiagnoseTools({ dryRun: true })
    const result = await tools.health_check()
    expect(result.status).toBe('healthy')
    expect(result.services).toBeDefined()
  })

  it('health_check reports specific service down', async () => {
    const tools = new SelfDiagnoseTools({ dryRun: true, simulateDown: ['browser-service'] })
    const result = await tools.health_check()
    expect(result.status).toBe('degraded')
    expect(result.services['browser-service']).toMatch(/down|unavailable/i)
  })

  it('recent_errors returns structured error list', async () => {
    const tools = new SelfDiagnoseTools({ dryRun: true })
    const errors = await tools.recent_errors()
    expect(Array.isArray(errors)).toBe(true)
  })

  it('recent_errors includes error details when errors exist', async () => {
    const tools = new SelfDiagnoseTools({
      dryRun: true,
      simulateErrors: ['timeout in browser-service'],
    })
    const errors = await tools.recent_errors()
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]?.message).toBeTruthy()
  })
})
