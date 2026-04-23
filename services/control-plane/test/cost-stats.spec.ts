/**
 * F-208: Token cost stats aggregator
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { CostTracker } from '../src/cost-stats.js'

function makeEvent(overrides: Partial<Parameters<CostTracker['record']>[0]> = {}) {
  return {
    sessionId: 'sess-1',
    agentId: 'agent-1',
    tokens: 100,
    costUsd: 0.002,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('F-208: CostTracker', () => {
  let tracker: CostTracker

  beforeEach(() => {
    tracker = new CostTracker()
  })

  it('returns zero totals when no events recorded', () => {
    const stats = tracker.getStats()
    expect(stats.totalCostUsd).toBe(0)
    expect(stats.totalTokens).toBe(0)
    expect(stats.sessions).toHaveLength(0)
    expect(stats.tools).toHaveLength(0)
    expect(stats.dailyTrend).toHaveLength(0)
  })

  it('aggregates totals across multiple events', () => {
    tracker.record(makeEvent({ tokens: 100, costUsd: 0.001 }))
    tracker.record(makeEvent({ tokens: 200, costUsd: 0.002 }))
    tracker.record(makeEvent({ tokens: 300, costUsd: 0.003 }))

    const stats = tracker.getStats()
    expect(stats.totalTokens).toBe(600)
    expect(stats.totalCostUsd).toBeCloseTo(0.006)
  })

  it('groups events by session', () => {
    tracker.record(makeEvent({ sessionId: 'sess-a', tokens: 100, costUsd: 0.001 }))
    tracker.record(makeEvent({ sessionId: 'sess-a', tokens: 200, costUsd: 0.002 }))
    tracker.record(makeEvent({ sessionId: 'sess-b', tokens: 50, costUsd: 0.0005 }))

    const stats = tracker.getStats()
    expect(stats.sessions).toHaveLength(2)
    const sessA = stats.sessions.find((s) => s.sessionId === 'sess-a')!
    expect(sessA.totalTokens).toBe(300)
    expect(sessA.totalCostUsd).toBeCloseTo(0.003)
  })

  it('groups events by tool and sorts by cost descending', () => {
    tracker.record(makeEvent({ toolId: 'shell_exec', tokens: 50, costUsd: 0.005 }))
    tracker.record(makeEvent({ toolId: 'fs_read', tokens: 20, costUsd: 0.001 }))
    tracker.record(makeEvent({ toolId: 'shell_exec', tokens: 30, costUsd: 0.003 }))

    const stats = tracker.getStats()
    expect(stats.tools).toHaveLength(2)
    expect(stats.tools[0]!.toolId).toBe('shell_exec')
    expect(stats.tools[0]!.totalCalls).toBe(2)
    expect(stats.tools[0]!.totalCostUsd).toBeCloseTo(0.008)
    expect(stats.tools[1]!.toolId).toBe('fs_read')
  })

  it('events without toolId are not included in tools list', () => {
    tracker.record(makeEvent({ toolId: undefined }))
    const stats = tracker.getStats()
    expect(stats.tools).toHaveLength(0)
  })

  it('builds a daily trend sorted by date ascending', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    tracker.record(makeEvent({ timestamp: yesterday.toISOString(), costUsd: 0.01, tokens: 1000 }))
    tracker.record(makeEvent({ timestamp: new Date().toISOString(), costUsd: 0.02, tokens: 2000 }))

    const stats = tracker.getStats()
    expect(stats.dailyTrend).toHaveLength(2)
    expect(stats.dailyTrend[0]!.date <= stats.dailyTrend[1]!.date).toBe(true)
    expect(stats.dailyTrend[1]!.totalCostUsd).toBeCloseTo(0.02)
  })

  it('excludes events older than the days window', () => {
    const old = new Date()
    old.setDate(old.getDate() - 10)

    tracker.record(makeEvent({ timestamp: old.toISOString(), costUsd: 99, tokens: 99999 }))
    tracker.record(makeEvent({ costUsd: 0.001, tokens: 10 }))

    const stats = tracker.getStats({ days: 7 })
    expect(stats.totalCostUsd).toBeCloseTo(0.001)
    expect(stats.totalTokens).toBe(10)
  })

  it('sessions are sorted by cost descending', () => {
    tracker.record(makeEvent({ sessionId: 'cheap', costUsd: 0.001, tokens: 10 }))
    tracker.record(makeEvent({ sessionId: 'expensive', costUsd: 0.1, tokens: 1000 }))

    const stats = tracker.getStats()
    expect(stats.sessions[0]!.sessionId).toBe('expensive')
  })

  it('reset() clears all recorded events', () => {
    tracker.record(makeEvent())
    tracker.record(makeEvent())
    tracker.reset()

    const stats = tracker.getStats()
    expect(stats.totalTokens).toBe(0)
    expect(stats.sessions).toHaveLength(0)
  })
})
