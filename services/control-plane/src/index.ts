import Fastify from 'fastify'
import { AgentOrchestrator } from './orchestrator.js'
import { resetAgent } from './mastra-instance.js'
import {
  loadSettings,
  saveSettings,
  isSetupComplete,
  isOnboardingComplete,
  saveUserProfile,
  applyEnvFromSettings,
  type AppSettings,
  type UserProfile,
} from './setup-store.js'
import { chatBus } from './chat-bus.js'
import { initDBOS, shutdownDBOS, GoalWorkflow, CronWorkflow } from './dbos-workflows.js'
import type { GoalWorkflowInput, CronWorkflowInput } from './dbos-workflows.js'
import { emitLog, queryLogs, knownAgents, knownTools } from './log-store.js'
import type { LogQuery } from './log-store.js'
import {
  initMessaging,
  shutdownMessaging,
  getMessagingStatus,
  reloadChannel,
} from './messaging-bridge.js'
import type { ChannelId } from '@open-greg/messaging'

const app = Fastify({ logger: true })

// Shared AbortController — signalled by /api/panic to stop all active turns
let panicAbortController = new AbortController()
export function getPanicSignal(): AbortSignal {
  return panicAbortController.signal
}

// ----------------------------------------------------------------
// REST endpoints (consumed by dashboard fetch() calls)
// ----------------------------------------------------------------

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))

// GET /api/logs — query the in-memory ring buffer
app.get<{
  Querystring: {
    level?: string
    agentId?: string
    toolId?: string
    limit?: string
    since?: string
  }
}>('/api/logs', async (req) => {
  const q: LogQuery = {}
  if (req.query.level) q.level = req.query.level
  if (req.query.agentId) q.agentId = req.query.agentId
  if (req.query.toolId) q.toolId = req.query.toolId
  if (req.query.limit) q.limit = Number(req.query.limit)
  if (req.query.since) q.since = req.query.since
  return {
    logs: queryLogs(q),
    agents: knownAgents(),
    tools: knownTools(),
  }
})

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

  const t0 = Date.now()
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
    emitLog({
      level: 'info',
      agentId: 'greg',
      message: `chat turn complete (${result.toolCalls?.length ?? 0} tool calls)`,
      durationMs: Date.now() - t0,
    })

    const tid = body.threadId ?? 'default'
    chatBus.publish({
      threadId: tid,
      role: 'user',
      content: body.message,
      source: 'dashboard',
      timestamp: new Date().toISOString(),
    })
    chatBus.publish({
      threadId: tid,
      role: 'assistant',
      content: result.content,
      source: 'system',
      senderName: 'greg',
      timestamp: new Date().toISOString(),
    })

    return { content: result.content, toolCalls: result.toolCalls }
  } catch (err) {
    emitLog({
      level: 'error',
      agentId: 'greg',
      message: `chat error: ${String(err)}`,
      durationMs: Date.now() - t0,
    })
    app.log.error(err)
    return reply.code(500).send({ error: String(err) })
  }
})

// POST /api/chat/stream — SSE streaming endpoint
// Emits: data: {"type":"chunk","text":"..."}\n\n
//        data: {"type":"tool","name":"...","args":{...}}\n\n
//        data: {"type":"done","msgId":"..."}\n\n
//        data: {"type":"error","message":"..."}\n\n
app.post<{
  Body: {
    message?: string
    history?: Array<{ role: string; content: string; timestamp?: string }>
    threadId?: string
    resourceId?: string
  }
}>('/api/chat/stream', async (req, reply) => {
  const body = req.body
  if (!body.message) {
    return reply.code(400).send({ error: 'message is required' })
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const send = (obj: Record<string, unknown>) => {
    reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`)
  }

  const t0 = Date.now()
  try {
    const toolCalls: Array<{ toolId: string; args: unknown; result: unknown }> = []
    await orchestrator.runTurn({
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
      onChunk: (chunk) => send({ type: 'chunk', text: chunk }),
      onToolCall: (name, args) => {
        toolCalls.push({ toolId: name, args, result: {} })
        emitLog({
          level: 'info',
          agentId: 'greg',
          toolId: name,
          message: `tool call: ${name}`,
          meta: { args } as Record<string, unknown>,
        })
        send({ type: 'tool', name, args })
      },
    })
    emitLog({
      level: 'info',
      agentId: 'greg',
      message: `stream turn complete (${toolCalls.length} tool calls)`,
      durationMs: Date.now() - t0,
    })
    send({ type: 'done', toolCalls })
  } catch (err) {
    emitLog({
      level: 'error',
      agentId: 'greg',
      message: `stream error: ${String(err)}`,
      durationMs: Date.now() - t0,
    })
    app.log.error(err)
    send({ type: 'error', message: String(err) })
  } finally {
    reply.raw.end()
  }
})

// POST /api/reset — reload agent after settings change
app.post('/api/reset', async () => {
  resetAgent()
  return { ok: true }
})

// POST /api/panic — emergency stop: abort all active agent sessions
app.post('/api/panic', async () => {
  panicAbortController.abort()
  // Replace controller so new turns can start after a panic
  panicAbortController = new AbortController()
  resetAgent()
  emitLog({ level: 'warn', agentId: 'system', message: 'PANIC: all active agent sessions aborted' })
  return { ok: true, message: 'All agent sessions aborted' }
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
// Chat bus — SSE stream for unified conversation view
// ----------------------------------------------------------------

/**
 * GET /api/chat/events?threadId=<id>
 * SSE stream: fires whenever a message (from any source) lands on the given thread.
 * If threadId is omitted, all messages are streamed.
 */
app.get<{ Querystring: { threadId?: string } }>('/api/chat/events', async (req, reply) => {
  const { threadId } = req.query

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const send = (data: object) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const unsubscribe = threadId ? chatBus.subscribeThread(threadId, send) : chatBus.subscribe(send)

  // Keepalive ping every 25 s
  const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000)

  req.raw.on('close', () => {
    clearInterval(ping)
    unsubscribe()
  })

  // Never resolve — connection stays open
  await new Promise<void>((resolve) => req.raw.on('close', resolve))
})

// ----------------------------------------------------------------
// Setup — first-run wizard API
// ----------------------------------------------------------------

/** GET /api/setup/status — is setup done? */
app.get('/api/setup/status', async () => ({
  setupComplete: isSetupComplete(),
  settings: (() => {
    const s = loadSettings()
    // Redact secrets — only send provider + whether keys exist
    return {
      llmProvider: s.llm.provider,
      hasAnthropicKey: Boolean(s.llm.anthropicKey),
      hasOpenaiKey: Boolean(s.llm.openaiKey),
      hasTelegramToken: Boolean(s.telegram?.botToken),
    }
  })(),
}))

/** POST /api/setup — save settings + restart agent */
app.post<{
  Body: {
    llmProvider?: string
    anthropicKey?: string
    openaiKey?: string
    ollamaModel?: string
    telegramBotToken?: string
  }
}>('/api/setup', async (req, reply) => {
  const { llmProvider, anthropicKey, openaiKey, ollamaModel, telegramBotToken } = req.body

  const provider = (llmProvider ?? 'ollama') as AppSettings['llm']['provider']
  const validProviders = ['anthropic', 'openai', 'ollama']
  if (!validProviders.includes(provider)) {
    return reply
      .code(400)
      .send({ error: `Invalid llmProvider. Must be one of: ${validProviders.join(', ')}` })
  }

  if (provider === 'anthropic' && !anthropicKey) {
    return reply.code(400).send({ error: 'anthropicKey is required when llmProvider is anthropic' })
  }
  if (provider === 'openai' && !openaiKey) {
    return reply.code(400).send({ error: 'openaiKey is required when llmProvider is openai' })
  }

  const llmConfig: AppSettings['llm'] = { provider }
  const trimmedAnthropic = anthropicKey?.trim()
  const trimmedOpenai = openaiKey?.trim()
  const trimmedOllama = ollamaModel?.trim()
  if (trimmedAnthropic) llmConfig.anthropicKey = trimmedAnthropic
  if (trimmedOpenai) llmConfig.openaiKey = trimmedOpenai
  if (trimmedOllama) llmConfig.ollamaModel = trimmedOllama

  const existing = loadSettings()
  const settings: AppSettings = {
    llm: llmConfig,
    setupComplete: true,
    onboardingComplete: existing.onboardingComplete,
    userProfile: existing.userProfile,
  }
  const trimmedToken = telegramBotToken?.trim()
  if (trimmedToken) settings.telegram = { botToken: trimmedToken }

  saveSettings(settings)
  applyEnvFromSettings()
  resetAgent() // pick up new model/keys immediately

  // Hot-reload Telegram if token was provided
  if (settings.telegram?.botToken) {
    try {
      await reloadChannel('telegram', { token: settings.telegram.botToken })
    } catch (err) {
      // Non-fatal — token may be invalid, user can retry
      app.log.warn(`Telegram reload failed: ${String(err)}`)
    }
  }

  return { ok: true }
})

// ----------------------------------------------------------------
// Messaging — bot status + hot-reload
// ----------------------------------------------------------------

app.get('/api/messaging/status', async () => ({
  bots: getMessagingStatus(),
}))

app.post<{
  Body: { channelId: ChannelId; fields: Record<string, string> }
}>('/api/messaging/reload', async (req, reply) => {
  const { channelId, fields } = req.body
  if (!channelId || !fields) {
    return reply.code(400).send({ error: 'channelId and fields are required' })
  }
  try {
    await reloadChannel(channelId, fields)
    return { ok: true, status: getMessagingStatus() }
  } catch (err) {
    return reply.code(500).send({ error: String(err) })
  }
})

// ----------------------------------------------------------------
// Onboarding — first-run chat profile collection
// ----------------------------------------------------------------

/** GET /api/onboarding — returns onboarding status + current profile */
app.get('/api/onboarding', async () => {
  const s = loadSettings()
  return {
    complete: s.onboardingComplete,
    profile: s.userProfile,
  }
})

/** POST /api/onboarding — save partial or complete profile */
app.post<{
  Body: Partial<UserProfile> & { complete?: boolean }
}>('/api/onboarding', async (req) => {
  const { complete, ...profile } = req.body
  saveUserProfile(profile, complete === true)
  resetAgent() // reload agent with new user profile in system prompt
  return { ok: true, complete: isOnboardingComplete() }
})

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------

const PORT = Number(process.env['CONTROL_PLANE_PORT'] ?? 3001)

// Apply persisted LLM keys before agent init
applyEnvFromSettings()

// Best-effort DBOS init — gracefully degrades if Postgres not available
await initDBOS()

// Start messaging bots (Telegram, Discord, etc.) — non-fatal if not configured
await initMessaging()

await app.listen({ port: PORT, host: '0.0.0.0' })

// Graceful shutdown
const shutdown = async () => {
  await app.close()
  await shutdownMessaging()
  await shutdownDBOS()
  process.exit(0)
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
