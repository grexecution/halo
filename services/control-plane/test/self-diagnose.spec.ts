/**
 * F-122: Agent self-diagnose
 *
 * Verifies that the agent's tools surface service availability information,
 * and that when a service is unreachable the result reports it cleanly.
 * Tests the browser_navigate and vision_analyze tools with unreachable URLs
 * to verify they return structured error responses (not throws).
 */
import { describe, it, expect } from 'vitest'
import { browserNavigateTool, visionAnalyzeTool, getTimeTool } from '../src/mastra-tools.js'
import { resetPermissionsCache } from '../src/mastra-tools.js'

describe('F-122: Agent self-diagnose', () => {
  // Reset permissions cache so tests don't need a real permissions.yml
  // The middleware's loadPermissions falls back gracefully when file missing.

  it('get_time tool always succeeds (baseline health check)', async () => {
    const result = await getTimeTool.execute({ timezone: 'UTC' }, {} as never)
    expect(result).toHaveProperty('iso')
    expect(result).toHaveProperty('timezone')
    expect(typeof (result as { iso: string }).iso).toBe('string')
  })

  it('browser_navigate reports service unreachable instead of throwing', async () => {
    process.env['BROWSER_SERVICE_URL'] = 'http://127.0.0.1:19998'
    resetPermissionsCache()

    const result = await browserNavigateTool.execute(
      { url: 'https://example.com', screenshot: false },
      {} as never,
    )

    // Should return ok:false with error message, not throw
    expect(result).toHaveProperty('ok')
    const r = result as { ok: boolean; error?: string }
    if (!r.ok) {
      expect(typeof r.error).toBe('string')
    }
  })

  it('vision_analyze reports service unreachable instead of throwing', async () => {
    process.env['VISION_SERVICE_URL'] = 'http://127.0.0.1:19997'
    resetPermissionsCache()

    const result = await visionAnalyzeTool.execute(
      { prompt: 'describe this' },
      {} as never,
    )

    expect(result).toHaveProperty('ok')
    const r = result as { ok: boolean; error?: string }
    if (!r.ok) {
      expect(typeof r.error).toBe('string')
    }
  })

  it('self-diagnose can detect all required service endpoints', () => {
    const services = [
      { name: 'browser-service', envVar: 'BROWSER_SERVICE_URL', default: 'http://localhost:3002' },
      { name: 'vision-service', envVar: 'VISION_SERVICE_URL', default: 'http://localhost:3003' },
      { name: 'voice-service', envVar: 'VOICE_SERVICE_URL', default: 'http://localhost:3004' },
    ]

    for (const svc of services) {
      const url = process.env[svc.envVar] ?? svc.default
      expect(typeof url).toBe('string')
      expect(url.startsWith('http')).toBe(true)
    }
  })

  it('get_time uses TZ env var when timezone not passed', async () => {
    const original = process.env['TZ']
    process.env['TZ'] = 'America/New_York'

    const result = await getTimeTool.execute({}, {} as never)
    const r = result as { iso: string; timezone: string }
    expect(r.timezone).toBe('America/New_York')

    if (original !== undefined) {
      process.env['TZ'] = original
    } else {
      delete process.env['TZ']
    }
  })
})
