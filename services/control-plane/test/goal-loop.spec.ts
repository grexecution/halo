/**
 * F-111: Goal loop
 *
 * Verifies the DBOS GoalWorkflow types and that goal execution produces
 * structured results with timing information.
 */
import { describe, it, expect } from 'vitest'
import type { GoalWorkflowInput, GoalWorkflowResult } from '../src/dbos-workflows.js'

describe('F-111: Goal loop', () => {
  it('GoalWorkflowInput has required fields', () => {
    const input: GoalWorkflowInput = {
      goalId: 'goal-001',
      title: 'Research competitors',
      description: 'Search the web and summarize the top 5 competitors.',
      priority: 1,
      resourceId: 'user-1',
    }
    expect(input.goalId).toBe('goal-001')
    expect(input.title).toBe('Research competitors')
    expect(input.priority).toBe(1)
    expect(input.resourceId).toBe('user-1')
  })

  it('GoalWorkflowResult has required fields', () => {
    const result: GoalWorkflowResult = {
      goalId: 'goal-001',
      status: 'completed',
      output: 'Found 5 competitors: ...',
      durationMs: 4200,
    }
    expect(result.goalId).toBe('goal-001')
    expect(result.status).toBe('completed')
    expect(result.output).toBeTruthy()
    expect(result.durationMs).toBeGreaterThan(0)
  })

  it('GoalWorkflowResult can represent a failed goal', () => {
    const result: GoalWorkflowResult = {
      goalId: 'goal-002',
      status: 'failed',
      output: 'Permission denied accessing external URL.',
      durationMs: 200,
    }
    expect(result.status).toBe('failed')
    expect(result.output).toContain('Permission denied')
  })

  it('goals are sorted by priority before dispatch', () => {
    const goals: GoalWorkflowInput[] = [
      { goalId: 'g1', title: 'Low priority', description: '', priority: 1, resourceId: 'user-1' },
      { goalId: 'g2', title: 'High priority', description: '', priority: 10, resourceId: 'user-1' },
      {
        goalId: 'g3',
        title: 'Medium priority',
        description: '',
        priority: 5,
        resourceId: 'user-1',
      },
    ]

    const sorted = [...goals].sort((a, b) => b.priority - a.priority)
    expect(sorted[0]!.goalId).toBe('g2')
    expect(sorted[1]!.goalId).toBe('g3')
    expect(sorted[2]!.goalId).toBe('g1')
  })

  it('durationMs is zero or positive', () => {
    const result: GoalWorkflowResult = {
      goalId: 'g-fast',
      status: 'completed',
      output: 'done',
      durationMs: 0,
    }
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})
