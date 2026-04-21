/**
 * F-131: Daily spend cap
 * Verifies global daily cost cap with soft warning and hard stop.
 */
import { describe, it, expect } from 'vitest'
import { DailyBudget } from '../src/budget.js'

describe('F-131: Daily spend cap', () => {
  it('allows spend below soft cap without warning', () => {
    const daily = new DailyBudget({ softCapUsd: 10, hardCapUsd: 50 })
    daily.record(3.0)
    const status = daily.status()
    expect(status.level).toBe('ok')
    expect(status.blocked).toBe(false)
  })

  it('warns when spend exceeds 40% of hard cap', () => {
    const daily = new DailyBudget({ softCapUsd: 10, hardCapUsd: 50 })
    daily.record(22.0) // 44% of 50
    const status = daily.status()
    expect(status.level).toBe('warn')
    expect(status.blocked).toBe(false)
  })

  it('blocks new sessions when hard cap is reached', () => {
    const daily = new DailyBudget({ softCapUsd: 10, hardCapUsd: 50 })
    daily.record(51.0)
    const status = daily.status()
    expect(status.level).toBe('hard')
    expect(status.blocked).toBe(true)
  })

  it('resets total at midnight (simulated)', () => {
    const daily = new DailyBudget({ softCapUsd: 10, hardCapUsd: 50 })
    daily.record(45.0)
    expect(daily.status().blocked).toBe(false)

    daily.record(10.0) // now 55 > 50
    expect(daily.status().blocked).toBe(true)

    // Simulate midnight reset
    daily.resetDay()
    expect(daily.status().blocked).toBe(false)
    expect(daily.totalUsd()).toBe(0)
  })

  it('reports total spend', () => {
    const daily = new DailyBudget({ softCapUsd: 10, hardCapUsd: 50 })
    daily.record(5.5)
    daily.record(3.2)
    expect(daily.totalUsd()).toBeCloseTo(8.7)
  })
})
