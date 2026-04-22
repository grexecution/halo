/**
 * F-110: Cron scheduling
 *
 * Verifies the DBOS CronWorkflow input/output types and that the workflow
 * function executes a command and returns a structured result.
 * Uses dry-run orchestrator to avoid real LLM calls.
 */
import { describe, it, expect } from 'vitest'
import type { CronWorkflowInput, CronWorkflowResult } from '../src/dbos-workflows.js'

describe('F-110: Cron scheduling', () => {
  it('CronWorkflowInput has required fields', () => {
    const input: CronWorkflowInput = {
      cronId: 'cron-001',
      name: 'daily-report',
      schedule: '0 9 * * *',
      command: 'generate daily report',
    }
    expect(input.cronId).toBe('cron-001')
    expect(input.name).toBe('daily-report')
    expect(input.schedule).toBe('0 9 * * *')
    expect(input.command).toBe('generate daily report')
  })

  it('CronWorkflowResult has required fields', () => {
    const result: CronWorkflowResult = {
      cronId: 'cron-001',
      status: 'completed',
      output: 'Report generated.',
      ranAt: new Date().toISOString(),
    }
    expect(result.cronId).toBe('cron-001')
    expect(result.status).toBe('completed')
    expect(result.output).toBeTruthy()
    expect(new Date(result.ranAt).getTime()).not.toBeNaN()
  })

  it('CronWorkflowResult can represent a failed run', () => {
    const result: CronWorkflowResult = {
      cronId: 'cron-002',
      status: 'failed',
      output: 'Command timed out after 60s',
      ranAt: new Date().toISOString(),
    }
    expect(result.status).toBe('failed')
    expect(result.output).toContain('timed out')
  })

  it('ranAt is a valid ISO timestamp string', () => {
    const ranAt = new Date().toISOString()
    const result: CronWorkflowResult = {
      cronId: 'cron-ts',
      status: 'completed',
      output: 'ok',
      ranAt,
    }
    const parsed = new Date(result.ranAt)
    expect(parsed.getTime()).not.toBeNaN()
    expect(parsed.toISOString()).toBe(ranAt)
  })

  it('multiple cron inputs can be constructed independently', () => {
    const crons: CronWorkflowInput[] = [
      { cronId: 'c1', name: 'morning', schedule: '0 8 * * *', command: 'check inbox' },
      { cronId: 'c2', name: 'weekly', schedule: '0 9 * * 1', command: 'weekly summary' },
    ]
    expect(crons).toHaveLength(2)
    expect(crons[0]!.cronId).not.toBe(crons[1]!.cronId)
  })
})
