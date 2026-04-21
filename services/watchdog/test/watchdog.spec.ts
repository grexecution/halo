/**
 * F-121: Watchdog heartbeats
 */
import { describe, it, expect } from 'vitest'
import { Watchdog } from '../src/index.js'

describe('F-121: Watchdog heartbeats', () => {
  it('registers a service heartbeat', () => {
    const wd = new Watchdog({ dryRun: true, timeoutMs: 90_000 })
    wd.heartbeat('browser-service')
    const status = wd.getServiceStatus('browser-service')
    expect(status.alive).toBe(true)
  })

  it('marks service as dead after heartbeat timeout', () => {
    const wd = new Watchdog({ dryRun: true, timeoutMs: 100 })
    wd.heartbeat('vision-service')
    // Simulate time passing by setting last heartbeat in the past
    wd._setLastHeartbeat('vision-service', Date.now() - 200)
    const status = wd.getServiceStatus('vision-service')
    expect(status.alive).toBe(false)
  })

  it('emits restart event for dead service', () => {
    const wd = new Watchdog({ dryRun: true, timeoutMs: 100 })
    const restarts: string[] = []
    wd.onRestart((serviceName) => restarts.push(serviceName))
    wd.heartbeat('control-plane')
    wd._setLastHeartbeat('control-plane', Date.now() - 200)
    wd.check()
    expect(restarts).toContain('control-plane')
  })

  it('does not restart healthy services', () => {
    const wd = new Watchdog({ dryRun: true, timeoutMs: 90_000 })
    const restarts: string[] = []
    wd.onRestart((s) => restarts.push(s))
    wd.heartbeat('healthy-service')
    wd.check()
    expect(restarts).not.toContain('healthy-service')
  })
})
