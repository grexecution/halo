/**
 * F-130: Per-session budget enforcement
 * Verifies that a session aborts cleanly when any budget limit is exceeded.
 */
import { describe, it, expect } from 'vitest'
import { SessionBudget, BudgetExceededError } from '../src/budget.js'

describe('F-130: Per-session budget enforcement', () => {
  it('allows a turn within token budget', () => {
    const budget = new SessionBudget({ maxTokens: 1000 })
    expect(() => budget.checkAndConsume({ tokens: 100 })).not.toThrow()
    expect(budget.totalTokens).toBe(100)
  })

  it('aborts when token budget is exceeded', () => {
    const budget = new SessionBudget({ maxTokens: 100 })
    budget.checkAndConsume({ tokens: 90 })
    expect(() => budget.checkAndConsume({ tokens: 20 })).toThrow(BudgetExceededError)
  })

  it('aborts when cost budget is exceeded', () => {
    const budget = new SessionBudget({ maxCostUsd: 0.1 })
    budget.checkAndConsume({ costUsd: 0.08 })
    expect(() => budget.checkAndConsume({ costUsd: 0.05 })).toThrow(BudgetExceededError)
  })

  it('aborts when max tool calls is exceeded', () => {
    const budget = new SessionBudget({ maxToolCalls: 3 })
    budget.checkAndConsume({ toolCalls: 1 })
    budget.checkAndConsume({ toolCalls: 1 })
    budget.checkAndConsume({ toolCalls: 1 })
    expect(() => budget.checkAndConsume({ toolCalls: 1 })).toThrow(BudgetExceededError)
  })

  it('aborts when max wall time is exceeded', async () => {
    const budget = new SessionBudget({ maxWallTimeSeconds: 0.05 })
    await new Promise((r) => setTimeout(r, 100))
    expect(() => budget.checkAndConsume({})).toThrow(BudgetExceededError)
  })

  it('provides a reason in the error', () => {
    const budget = new SessionBudget({ maxTokens: 10 })
    budget.checkAndConsume({ tokens: 5 })
    try {
      budget.checkAndConsume({ tokens: 10 })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(BudgetExceededError)
      expect((e as BudgetExceededError).message).toContain('token')
    }
  })
})
