/**
 * Durable goal-loop + cron workflows backed by DBOS Transact.
 *
 * DBOS checkpoints every step in Postgres — if the process crashes mid-goal,
 * it resumes from the last completed step on restart.
 *
 * Requires POSTGRES_URL env var (same DB as the rest of the app).
 */
import { DBOS } from '@dbos-inc/dbos-sdk'
import { AgentOrchestrator } from './orchestrator.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoalWorkflowInput {
  goalId: string
  title: string
  description: string
  priority: number
  resourceId: string
}

export interface GoalWorkflowResult {
  goalId: string
  status: 'completed' | 'failed'
  output: string
  durationMs: number
}

export interface CronWorkflowInput {
  cronId: string
  name: string
  schedule: string
  command: string
}

export interface CronWorkflowResult {
  cronId: string
  status: 'completed' | 'failed'
  output: string
  ranAt: string
}

// ---------------------------------------------------------------------------
// Steps (individual durable checkpoints)
// ---------------------------------------------------------------------------

async function _runGoalStep(input: GoalWorkflowInput): Promise<string> {
  const orchestrator = new AgentOrchestrator()
  const result = await orchestrator.runTurn({
    agent: {
      id: 'greg',
      handle: 'greg',
      systemPrompt: `You are executing goal: "${input.title}"\n${input.description}`,
      model: 'auto',
      timezone: process.env['TZ'] ?? 'UTC',
    },
    message: `Execute goal: ${input.title}\n\n${input.description}`,
    resourceId: input.resourceId,
    threadId: `goal-${input.goalId}`,
  })
  return result.content
}

async function _runCronStep(input: CronWorkflowInput): Promise<string> {
  const orchestrator = new AgentOrchestrator()
  const result = await orchestrator.runTurn({
    agent: {
      id: 'greg',
      handle: 'greg',
      systemPrompt: `You are running a scheduled task: "${input.name}"`,
      model: 'auto',
      timezone: process.env['TZ'] ?? 'UTC',
    },
    message: input.command,
    threadId: `cron-${input.cronId}`,
    resourceId: `cron-${input.cronId}`,
  })
  return result.content
}

// ---------------------------------------------------------------------------
// Workflow functions (registered with DBOS for durability)
// ---------------------------------------------------------------------------

async function goalWorkflowFn(input: GoalWorkflowInput): Promise<GoalWorkflowResult> {
  const start = Date.now()

  const output = await runGoalStep(input)

  return {
    goalId: input.goalId,
    status: 'completed',
    output,
    durationMs: Date.now() - start,
  }
}

async function cronWorkflowFn(input: CronWorkflowInput): Promise<CronWorkflowResult> {
  const output = await runCronStep(input)

  return {
    cronId: input.cronId,
    status: 'completed',
    output,
    ranAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Registered (durable) versions
// ---------------------------------------------------------------------------

export const runGoalStep = DBOS.registerStep(_runGoalStep, { name: 'runGoalStep' })
export const runCronStep = DBOS.registerStep(_runCronStep, { name: 'runCronStep' })

export const GoalWorkflow = DBOS.registerWorkflow(goalWorkflowFn, { name: 'GoalWorkflow' })
export const CronWorkflow = DBOS.registerWorkflow(cronWorkflowFn, { name: 'CronWorkflow' })

// ---------------------------------------------------------------------------
// DBOS init helper (call once at startup, only if Postgres is configured)
// ---------------------------------------------------------------------------

let _initialized = false

export async function initDBOS(): Promise<boolean> {
  if (_initialized) return true

  const pgUrl = process.env['POSTGRES_URL'] ?? process.env['DATABASE_URL']
  if (!pgUrl) {
    return false
  }

  try {
    DBOS.setConfig({ systemDatabaseUrl: pgUrl, runAdminServer: false })
    await DBOS.launch()
    _initialized = true
    return true
  } catch {
    return false
  }
}

export async function shutdownDBOS(): Promise<void> {
  if (_initialized) {
    await DBOS.shutdown()
    _initialized = false
  }
}
