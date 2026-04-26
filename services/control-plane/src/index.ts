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
import { skillLoader } from './skill-loader.js'
import { startHeartbeat, stopHeartbeat } from './heartbeat.js'
import { initMemoryPipeline, getMemoryPipeline } from './memory-pipeline.js'
import { parseImportFile } from './memory-import.js'
import type { ImportFormat } from './memory-import.js'
import { pluginLoader } from './plugin-loader.js'
import { globalCostTracker } from './cost-stats.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// GET /api/cost-stats — aggregate token/cost usage by session, tool, and model
app.get<{ Querystring: { days?: string } }>('/api/cost-stats', async (req, reply) => {
  const days = Number(req.query.days ?? '7')
  if (!Number.isFinite(days) || days <= 0) {
    return reply.code(400).send({ error: 'days must be a positive number' })
  }
  return globalCostTracker.getStats({ days })
})

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
      threadId: body.threadId ?? 'default',
      resourceId: body.resourceId ?? 'user',
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
    agentConfig?: {
      id: string
      handle: string
      model: string
      systemPrompt: string
      timezone?: string
    }
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
    let chunkCount = 0
    const agentCfg = body.agentConfig ?? {
      id: 'greg',
      handle: 'greg',
      systemPrompt: '',
      model: 'auto',
      timezone: process.env['TZ'] ?? 'UTC',
    }
    await orchestrator.runTurn({
      agent: agentCfg,
      message: body.message,
      history: body.history?.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.timestamp ?? new Date().toISOString(),
      })),
      threadId: body.threadId ?? 'default',
      resourceId: body.resourceId ?? 'user',
      onChunk: (chunk) => {
        chunkCount++
        send({ type: 'chunk', text: chunk })
      },
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

    // If zero chunks were emitted the configured model failed silently (e.g. invalid
    // plugin API key). Fall back to the default Ollama agent and try once more so
    // the user always gets a response instead of a blank message.
    if (chunkCount === 0 && agentCfg.model && agentCfg.model !== 'auto') {
      emitLog({
        level: 'warn',
        agentId: 'greg',
        message: `model "${agentCfg.model}" produced no output — falling back to default model`,
        durationMs: Date.now() - t0,
      })
      // Notify client so the user understands what happened
      send({
        type: 'chunk',
        text: `⚠️ *Note: the configured model (${agentCfg.model}) failed to respond — using the default model instead.*\n\n`,
      })
      chunkCount++
      await orchestrator.runTurn({
        agent: {
          id: 'greg',
          handle: 'greg',
          systemPrompt: agentCfg.systemPrompt ?? '',
          model: 'auto',
          timezone: agentCfg.timezone ?? 'UTC',
        },
        message: body.message,
        history: body.history?.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: m.timestamp ?? new Date().toISOString(),
        })),
        threadId: body.threadId ?? 'default',
        resourceId: body.resourceId ?? 'user',
        onChunk: (chunk) => {
          chunkCount++
          send({ type: 'chunk', text: chunk })
        },
        onToolCall: (name, args) => {
          toolCalls.push({ toolId: name, args, result: {} })
          send({ type: 'tool', name, args })
        },
      })
    }

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
// Skills API
// ----------------------------------------------------------------

// GET /api/skills — list all skills with credential status
app.get('/api/skills', async () => {
  const skills = skillLoader.list()
  const result = await Promise.all(
    skills.map(async (s) => {
      const missing = await skillLoader.missingCredentials(s.name)
      return {
        name: s.name,
        description: s.description,
        version: s.version,
        requiresEnv: s.requiresEnv,
        enabled: s.enabled,
        credentialStatus: s.requiresEnv.map((key) => ({
          key,
          set: !missing.includes(key),
        })),
      }
    }),
  )
  return { skills: result }
})

// GET /api/skills/:name — get a single skill including its body
app.get<{ Params: { name: string } }>('/api/skills/:name', async (req, reply) => {
  const skill = skillLoader.get(req.params.name)
  if (!skill) return reply.status(404).send({ error: 'Skill not found' })
  const missing = await skillLoader.missingCredentials(skill.name)
  return {
    ...skill,
    credentialStatus: skill.requiresEnv.map((key) => ({
      key,
      set: !missing.includes(key),
    })),
  }
})

// POST /api/skills/:name — create or update a skill
app.post<{
  Params: { name: string }
  Body: {
    description?: string
    body?: string
    requiresEnv?: string[]
    enabled?: boolean
  }
}>('/api/skills/:name', async (req, reply) => {
  const { name } = req.params
  const existing = skillLoader.get(name)
  if (!req.body.description && !req.body.body && !existing) {
    return reply.status(400).send({ error: 'description and body are required for new skills' })
  }
  const skill = skillLoader.createOrUpdate({
    name,
    description: req.body.description ?? existing?.description ?? '',
    body: req.body.body ?? existing?.body ?? '',
    requiresEnv: req.body.requiresEnv ?? existing?.requiresEnv ?? [],
    enabled: req.body.enabled ?? existing?.enabled ?? true,
    ...(existing?.version ? { version: existing.version } : {}),
  })
  return { ok: true, skill }
})

// DELETE /api/skills/:name — delete a skill
app.delete<{ Params: { name: string } }>('/api/skills/:name', async (req, reply) => {
  const deleted = skillLoader.delete(req.params.name)
  if (!deleted) return reply.status(404).send({ error: 'Skill not found' })
  return { ok: true }
})

// POST /api/skills/:name/toggle — enable or disable a skill
app.post<{ Params: { name: string }; Body: { enabled: boolean } }>(
  '/api/skills/:name/toggle',
  async (req, reply) => {
    const ok = skillLoader.toggle(req.params.name, req.body.enabled)
    if (!ok) return reply.status(404).send({ error: 'Skill not found' })
    return { ok: true, enabled: req.body.enabled }
  },
)

// POST /api/skills/:name/credentials — store a credential for a skill
app.post<{
  Params: { name: string }
  Body: { envKey: string; value: string }
}>('/api/skills/:name/credentials', async (req, reply) => {
  const { envKey, value } = req.body
  if (!envKey || !value) return reply.status(400).send({ error: 'envKey and value are required' })
  await skillLoader.storeCredential(envKey, value)
  const missing = await skillLoader.missingCredentials(req.params.name)
  return { ok: true, missingCredentials: missing }
})

// GET /api/skills/:name/credentials — list credential status (no values returned)
app.get<{ Params: { name: string } }>('/api/skills/:name/credentials', async (req, reply) => {
  const skill = skillLoader.get(req.params.name)
  if (!skill) return reply.status(404).send({ error: 'Skill not found' })
  const missing = await skillLoader.missingCredentials(skill.name)
  return {
    credentials: skill.requiresEnv.map((key) => ({
      key,
      set: !missing.includes(key),
    })),
  }
})

// ----------------------------------------------------------------
// Update endpoint — git pull + docker compose pull + up
// ----------------------------------------------------------------

app.get('/api/update/check', async () => {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)
  try {
    // Fetch latest commits without merging
    await execAsync('git fetch origin main', { cwd: process.cwd() })
    const { stdout: behind } = await execAsync('git rev-list HEAD..origin/main --count', {
      cwd: process.cwd(),
    })
    const { stdout: currentSha } = await execAsync('git rev-parse --short HEAD', {
      cwd: process.cwd(),
    })
    const { stdout: latestSha } = await execAsync('git rev-parse --short origin/main', {
      cwd: process.cwd(),
    })
    const commitsAvailable = parseInt(behind.trim(), 10)
    return {
      upToDate: commitsAvailable === 0,
      commitsAvailable,
      currentVersion: currentSha.trim(),
      latestVersion: latestSha.trim(),
    }
  } catch {
    return {
      upToDate: true,
      commitsAvailable: 0,
      currentVersion: 'unknown',
      latestVersion: 'unknown',
      error: 'git not available',
    }
  }
})

app.post('/api/update/apply', async (_, reply) => {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  reply.header('Content-Type', 'text/event-stream')
  reply.header('Cache-Control', 'no-cache')
  reply.header('Connection', 'keep-alive')

  const send = (msg: string) => reply.raw.write(`data: ${JSON.stringify({ msg })}\n\n`)

  try {
    send('Pulling latest code...')
    await execAsync('git pull origin main', { cwd: process.cwd() })
    send('Code updated.')

    send('Pulling new Docker images...')
    await execAsync('docker compose pull', { cwd: process.cwd() })
    send('Images updated.')

    send('Restarting containers...')
    await execAsync('docker compose up -d', { cwd: process.cwd() })
    send('done')
  } catch (err) {
    send(`error: ${err instanceof Error ? err.message : String(err)}`)
  }

  reply.raw.end()
})

// ----------------------------------------------------------------
// Memory — Browse (cursor-based pagination) + Delete
// ----------------------------------------------------------------

/**
 * GET /api/memory/browse
 * Query: q=..., source=..., cursor=ISO-timestamp, limit=N
 */
app.get<{
  Querystring: { q?: string; source?: string; cursor?: string; limit?: string }
}>('/api/memory/browse', async (req, reply) => {
  const pipeline = getMemoryPipeline()
  if (!pipeline) {
    return reply.code(503).send({ error: 'Memory pipeline not available' })
  }
  const { q, source, cursor, limit: limitStr } = req.query
  const limit = limitStr ? Math.min(Number(limitStr), 200) : 50
  return pipeline.browseMemories({
    ...(q != null ? { q } : {}),
    ...(source != null ? { source } : {}),
    ...(cursor != null ? { cursor } : {}),
    limit,
  })
})

/**
 * DELETE /api/memory/:id
 */
app.delete<{ Params: { id: string } }>('/api/memory/:id', async (req, reply) => {
  const pipeline = getMemoryPipeline()
  if (!pipeline) {
    return reply.code(503).send({ error: 'Memory pipeline not available' })
  }
  const deleted = await pipeline.deleteMemory(req.params.id)
  if (!deleted) return reply.code(404).send({ error: 'Memory not found' })
  return { ok: true }
})

// ----------------------------------------------------------------
// Memory — Import
// ----------------------------------------------------------------

/**
 * POST /api/memory/import
 * Accepts raw file content + format hint in JSON body.
 * Body: { content: string, format?: 'chatgpt'|'claude'|'telegram'|'whatsapp'|'json'|'csv'|'auto' }
 */
app.post<{
  Body: { content: string; format?: string; filename?: string }
}>('/api/memory/import', async (req, reply) => {
  const pipeline = getMemoryPipeline()
  if (!pipeline) {
    return reply.code(503).send({ error: 'Memory pipeline not available — DATABASE_URL not set' })
  }

  const { content, format: rawFormat, filename } = req.body
  if (!content) return reply.code(400).send({ error: 'content is required' })

  // Auto-detect format from filename if not specified
  let format = (rawFormat ?? 'auto') as ImportFormat
  if (format === 'auto' && filename) {
    if (filename.endsWith('.txt')) format = 'whatsapp'
    else if (filename.endsWith('.csv')) format = 'csv'
  }

  const { entries, format: detectedFormat, error } = parseImportFile(content, format)
  if (error) return reply.code(400).send({ error: `Parse error: ${error}` })
  if (!entries.length) return reply.code(400).send({ error: 'No entries found in file' })

  let inserted = 0
  let failed = 0
  for (const entry of entries) {
    try {
      await pipeline.upsertMemory(entry, 5)
      inserted++
    } catch {
      failed++
    }
  }

  return {
    ok: true,
    detectedFormat,
    total: entries.length,
    inserted,
    failed,
    message: `Imported ${inserted} memories from ${detectedFormat}. Embeddings queued for background processing.`,
  }
})

// ----------------------------------------------------------------
// Memory — Export
// ----------------------------------------------------------------

/**
 * GET /api/memory/export
 * Streams all memories as JSON or CSV.
 * Query: format=json|csv, source=..., type=..., since=ISO-date, limit=N
 */
app.get<{
  Querystring: { format?: string; source?: string; type?: string; since?: string; limit?: string }
}>('/api/memory/export', async (req, reply) => {
  const pipeline = getMemoryPipeline()
  if (!pipeline) {
    return reply.code(503).send({ error: 'Memory pipeline not available — DATABASE_URL not set' })
  }

  const { format = 'json', source, type, since, limit: limitStr } = req.query
  const limit = limitStr ? Math.min(Number(limitStr), 100_000) : 100_000

  const rows = await pipeline.exportMemories({
    ...(source != null ? { source } : {}),
    ...(type != null ? { type } : {}),
    ...(since != null ? { since } : {}),
    limit,
  })

  if (format === 'csv') {
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="halo-memories.csv"')
    const header = 'id,source,type,content,tags,created_at\n'
    const lines = rows.map((r) =>
      [
        r.id,
        r.source,
        r.type,
        `"${r.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(r.tags ?? []).join(';')}"`,
        r.createdAt,
      ].join(','),
    )
    return reply.send(header + lines.join('\n'))
  }

  // JSON
  reply.header('Content-Type', 'application/json')
  reply.header('Content-Disposition', 'attachment; filename="halo-memories.json"')
  return reply.send(
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        count: rows.length,
        memories: rows.map((r) => ({
          id: r.id,
          source: r.source,
          type: r.type,
          content: r.content,
          tags: r.tags,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })),
      },
      null,
      2,
    ),
  )
})

// ----------------------------------------------------------------
// Plugins
// ----------------------------------------------------------------

/** GET /api/plugins — list all discovered plugins */
app.get('/api/plugins', async () => ({
  plugins: pluginLoader.list().map((p) => ({
    name: p.name,
    description: p.description,
    version: p.version,
    credentialSet: p.credentialSet,
    authType: p.auth.type,
    credentialKey: p.auth.credentialKey,
    tools: p.tools.map((t) => t.name),
  })),
}))

/** POST /api/plugins/:name/credential — set API key for a plugin */
app.post<{
  Params: { name: string }
  Body: { value: string }
}>('/api/plugins/:name/credential', async (req, reply) => {
  const { name } = req.params
  const { value } = req.body
  if (!value) return reply.code(400).send({ error: 'value is required' })
  try {
    await pluginLoader.setCredential(name, value)
    return { ok: true, plugin: name }
  } catch (err) {
    return reply.code(404).send({ error: String(err) })
  }
})

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------

const PORT = Number(process.env['CONTROL_PLANE_PORT'] ?? 3001)

// Apply persisted LLM keys before agent init
applyEnvFromSettings()

// Bootstrap bundled skills + start file watcher
skillLoader.init()

// Auto-discover and load plugins from services/plugins/
await pluginLoader.init()

// Best-effort DBOS init — gracefully degrades if Postgres not available
await initDBOS()

// Start messaging bots (Telegram, Discord, etc.) — non-fatal if not configured
await initMessaging()

// Initialise lifetime memory pipeline (Postgres-backed) — non-fatal if DB not available
const pgUrl = process.env['DATABASE_URL']
if (pgUrl) {
  try {
    const pipeline = initMemoryPipeline(pgUrl)
    await pipeline.connect()

    // Run schema migration (idempotent — safe to call on every startup)
    const migrationPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'migrations',
      '001-lifetime-memory.sql',
    )
    try {
      const migrationSql = readFileSync(migrationPath, 'utf-8')
      await pipeline.runMigration(migrationSql)
    } catch (migErr) {
      app.log.warn(`Memory migration skipped: ${migErr}`)
    }

    // Start the async embedding worker
    pipeline.startWorker()
    app.log.info('Lifetime memory pipeline started')
  } catch (err) {
    app.log.warn(`Memory pipeline init failed (non-fatal): ${err}`)
  }
} else {
  app.log.info('DATABASE_URL not set — lifetime memory pipeline disabled')
}

// Start the heartbeat scheduler (cron tick + periodic check-in)
const heartbeatMinutes = Number(process.env['HEARTBEAT_INTERVAL_MINUTES'] ?? 30)
startHeartbeat(heartbeatMinutes)

await app.listen({ port: PORT, host: '0.0.0.0' })

// Graceful shutdown
const shutdown = async () => {
  stopHeartbeat()
  skillLoader.stop()
  await app.close()
  await shutdownMessaging()
  await shutdownDBOS()
  process.exit(0)
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
