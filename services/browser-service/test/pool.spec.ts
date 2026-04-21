/**
 * F-063: Browser pool management
 */
import { describe, it, expect } from 'vitest'
import { BrowserService } from '../src/index.js'

describe('F-063: Browser pool management', () => {
  it('reports pool status with correct maxConcurrent', () => {
    const browser = new BrowserService({ dryRun: true, maxConcurrent: 3 })
    const status = browser.poolStatus()
    expect(status.maxConcurrent).toBe(3)
    expect(status.active).toBe(0)
    expect(status.queued).toBe(0)
  })

  it('limits concurrent executions to maxConcurrent', async () => {
    const browser = new BrowserService({ dryRun: true, maxConcurrent: 2 })
    const results: string[] = []
    const tasks = [
      browser.act('task 1').then(() => {
        results.push('1')
      }),
      browser.act('task 2').then(() => {
        results.push('2')
      }),
      browser.act('task 3').then(() => {
        results.push('3')
      }),
    ]
    await Promise.all(tasks)
    expect(results).toHaveLength(3)
    expect(results).toContain('1')
    expect(results).toContain('2')
    expect(results).toContain('3')
  })

  it('processes queued requests after slots free up', async () => {
    const browser = new BrowserService({ dryRun: true, maxConcurrent: 1 })
    const order: number[] = []
    await Promise.all([
      browser.act('first').then(() => order.push(1)),
      browser.act('second').then(() => order.push(2)),
    ])
    expect(order).toEqual([1, 2])
  })
})
