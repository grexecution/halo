/**
 * F-111: Goal loop worker
 */
import { describe, it, expect } from 'vitest'
import { GoalLoopWorker } from '../src/goal-loop.js'

describe('F-111: Goal loop worker', () => {
  it('runs goals in priority order', async () => {
    const worker = new GoalLoopWorker({ dryRun: true })
    const goals = [
      { id: 'g1', title: 'Low priority task', priority: 1 },
      { id: 'g2', title: 'High priority task', priority: 10 },
      { id: 'g3', title: 'Medium priority task', priority: 5 },
    ]
    const order = await worker.runGoals(goals)
    expect(order[0]).toBe('g2')
    expect(order[1]).toBe('g3')
    expect(order[2]).toBe('g1')
  })

  it('marks goals as completed after running', async () => {
    const worker = new GoalLoopWorker({ dryRun: true })
    const goals = [{ id: 'g4', title: 'Single task', priority: 5 }]
    await worker.runGoals(goals)
    const status = worker.getGoalStatus('g4')
    expect(status).toBe('completed')
  })

  it('reports progress for multiple goals', async () => {
    const worker = new GoalLoopWorker({ dryRun: true })
    const goals = [
      { id: 'g5', title: 'Task A', priority: 3 },
      { id: 'g6', title: 'Task B', priority: 7 },
    ]
    await worker.runGoals(goals)
    const summary = worker.getSummary()
    expect(summary.completed).toBe(2)
    expect(summary.failed).toBe(0)
  })
})
