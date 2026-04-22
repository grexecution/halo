/**
 * tRPC router for the control-plane.
 * Exposes procedures callable by the dashboard.
 */
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { DBOS } from '@dbos-inc/dbos-sdk'
import { AgentOrchestrator } from './orchestrator.js'
import { getMemory, resetAgent } from './mastra-instance.js'
import { GoalWorkflow, CronWorkflow } from './dbos-workflows.js'

const t = initTRPC.create()

export const router = t.router
export const procedure = t.procedure

const orchestrator = new AgentOrchestrator()

export const appRouter = router({
  // ------------------------------------------------------------------
  // Health
  // ------------------------------------------------------------------
  health: procedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })),

  // ------------------------------------------------------------------
  // Chat — single turn
  // ------------------------------------------------------------------
  chat: procedure
    .input(
      z.object({
        message: z.string().min(1),
        history: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant', 'system']),
              content: z.string(),
              timestamp: z.string().optional(),
            }),
          )
          .optional(),
        threadId: z.string().optional(),
        resourceId: z.string().optional(),
        agentId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await orchestrator.runTurn({
        agent: {
          id: input.agentId ?? 'greg',
          handle: 'greg',
          systemPrompt: '',
          model: 'auto',
          timezone: process.env['TZ'] ?? 'UTC',
        },
        message: input.message,
        history: input.history?.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ?? new Date().toISOString(),
        })),
        threadId: input.threadId,
        resourceId: input.resourceId,
      })
      return { content: result.content, toolCalls: result.toolCalls }
    }),

  // ------------------------------------------------------------------
  // Memory — search
  // ------------------------------------------------------------------
  memorySearch: procedure
    .input(
      z.object({ query: z.string(), threadId: z.string().optional(), topK: z.number().optional() }),
    )
    .query(async ({ input }) => {
      const memory = getMemory()
      const results = await memory.searchMessages({
        query: input.query,
        resourceId: 'user',
        topK: input.topK ?? 10,
      })
      return { results }
    }),

  // ------------------------------------------------------------------
  // Goals — dispatch each goal as a durable DBOS workflow
  // ------------------------------------------------------------------
  runGoals: procedure
    .input(
      z.object({
        goals: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
            priority: z.number(),
            resourceId: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      // Sort by priority descending before dispatching
      const sorted = [...input.goals].sort((a, b) => b.priority - a.priority)

      const handles = await Promise.all(
        sorted.map((g) =>
          DBOS.startWorkflow(GoalWorkflow)({
            goalId: g.id,
            title: g.title,
            description: g.description ?? g.title,
            priority: g.priority,
            resourceId: g.resourceId ?? 'user',
          }),
        ),
      )

      return {
        dispatched: handles.map((h, i) => ({
          goalId: sorted[i]!.id,
          workflowId: h.workflowID,
        })),
      }
    }),

  // ------------------------------------------------------------------
  // Crons — dispatch a cron job as a durable DBOS workflow
  // ------------------------------------------------------------------
  runCron: procedure
    .input(
      z.object({
        cronId: z.string(),
        name: z.string(),
        schedule: z.string(),
        command: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const handle = await DBOS.startWorkflow(CronWorkflow)({
        cronId: input.cronId,
        name: input.name,
        schedule: input.schedule,
        command: input.command,
      })
      return { workflowId: handle.workflowID }
    }),

  // ------------------------------------------------------------------
  // Agent reset (after settings change)
  // ------------------------------------------------------------------
  resetAgent: procedure.mutation(() => {
    resetAgent()
    return { ok: true }
  }),
})

export type AppRouter = typeof appRouter
