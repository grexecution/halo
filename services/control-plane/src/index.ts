import Fastify from 'fastify'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './trpc-router.js'
import { AgentOrchestrator } from './orchestrator.js'
import { resetAgent } from './mastra-instance.js'
import { initDBOS, shutdownDBOS, GoalWorkflow, CronWorkflow } from './dbos-workflows.js'
import type { GoalWorkflowInput, CronWorkflowInput } from './dbos-workflows.js'

const app = Fastify({ logger: true })

// ----------------------------------------------------------------
// tRPC — all procedures under /trpc
// ----------------------------------------------------------------
await app.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: { router: appRouter },
})

// ----------------------------------------------------------------
// REST convenience endpoints (used by dashboard fetch() calls)
// ----------------------------------------------------------------

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))

const orchestrator = new AgentOrchestrator()

// POST /api/chat — mirrors tRPC chat mutation for simple fetch() callers
app.post<{
  Body: {
    message?: string
    history?: Array<{ role: string; content: string; timestamp?: string }>
    threadId?: string
    resourceId?: string
  }
}>('/api/chat', async (req, reply) => {
  const body = req.body
  if (!body.message) {
    return reply.code(400).send({ error: 'message is required' })
  }

  try {
    const result = await orchestrator.runTurn({
      agent: {
        id: 'greg',
        handle: 'greg',
        systemPrompt: '',
        model: 'auto',
        timezone: process.env['TZ'] ?? 'UTC',
      },
      message: body.message,
      history: body.history?.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.timestamp ?? new Date().toISOString(),
      })),
      threadId: body.threadId,
      resourceId: body.resourceId,
    })
    return { content: result.content, toolCalls: result.toolCalls }
  } catch (err) {
    app.log.error(err)
    return reply.code(500).send({ error: String(err) })
  }
})

// POST /api/reset — reload agent after settings change
app.post('/api/reset', async () => {
  resetAgent()
  return { ok: true }
})

// POST /api/goals/execute — dispatch a goal as a DBOS durable workflow
app.post<{ Body: Omit<GoalWorkflowInput, 'resourceId'> & { resourceId?: string } }>(
  '/api/goals/execute',
  async (req, reply) => {
    const { goalId, title, description, priority, resourceId = 'user' } = req.body
    if (!goalId || !title) return reply.code(400).send({ error: 'goalId and title are required' })

    try {
      const result = await GoalWorkflow({
        goalId,
        title,
        description: description ?? title,
        priority: priority ?? 5,
        resourceId,
      })
      return { workflowId: `goal-${goalId}`, output: result.output, status: result.status }
    } catch (err) {
      app.log.error(err)
      // DBOS not available — run inline (best effort)
      try {
        const orchestrator = new AgentOrchestrator()
        const result = await orchestrator.runTurn({
          agent: {
            id: 'greg',
            handle: 'greg',
            systemPrompt: `Execute goal: "${title}"\n${description ?? ''}`,
            model: 'auto',
            timezone: process.env['TZ'] ?? 'UTC',
          },
          message: `Execute goal: ${title}\n\n${description ?? ''}`,
          threadId: `goal-${goalId}`,
          resourceId,
        })
        return { workflowId: null, output: result.content }
      } catch (e) {
        return reply.code(500).send({ error: String(e) })
      }
    }
  },
)

// POST /api/crons/run — dispatch a cron job as a DBOS durable workflow
app.post<{ Body: CronWorkflowInput }>('/api/crons/run', async (req, reply) => {
  const { cronId, name, schedule, command } = req.body
  if (!cronId || !command) return reply.code(400).send({ error: 'cronId and command are required' })

  try {
    const result = await CronWorkflow({
      cronId,
      name: name ?? cronId,
      schedule: schedule ?? '',
      command,
    })
    return {
      workflowId: `cron-${cronId}`,
      output: result.output,
      status: result.status,
      ranAt: result.ranAt,
    }
  } catch (err) {
    app.log.error(err)
    // DBOS not available — run inline (best effort)
    try {
      const orchestrator = new AgentOrchestrator()
      const result = await orchestrator.runTurn({
        agent: {
          id: 'greg',
          handle: 'greg',
          systemPrompt: `Running scheduled task: "${name}"`,
          model: 'auto',
          timezone: process.env['TZ'] ?? 'UTC',
        },
        message: command,
        threadId: `cron-${cronId}`,
        resourceId: `cron-${cronId}`,
      })
      return { workflowId: null, output: result.content }
    } catch (e) {
      return reply.code(500).send({ error: String(e) })
    }
  }
})

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------

const PORT = Number(process.env['CONTROL_PLANE_PORT'] ?? 3001)

// Best-effort DBOS init — gracefully degrades if Postgres not available
await initDBOS()

await app.listen({ port: PORT, host: '0.0.0.0' })

// Graceful shutdown
const shutdown = async () => {
  await app.close()
  await shutdownDBOS()
  process.exit(0)
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
