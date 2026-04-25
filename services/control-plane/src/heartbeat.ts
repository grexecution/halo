/**
 * Heartbeat scheduler — fires cron jobs and a configurable periodic wake-up.
 *
 * Two behaviours:
 *
 * 1. **Cron jobs**: every minute we read all active cron jobs from SQLite,
 *    compare their next_run_at to now, and fire any that are overdue.
 *    Results are sent to the user via Telegram.
 *
 * 2. **Heartbeat**: a configurable interval (default 30 min) that wakes the
 *    agent and asks it to check in — send a morning briefing, surface
 *    pending goals, notice anything unusual. This is the OpenClaw "HEARTBEAT.md"
 *    equivalent. The agent's reply is sent via notify_user.
 *
 * The scheduler starts in index.ts after messaging is initialised.
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { emitLog } from './log-store.js'
import { AgentOrchestrator } from './orchestrator.js'
import { loadSettings } from './setup-store.js'
import { sendTelegramNotification } from './notifier.js'

const DB_PATH = join(homedir(), '.open-greg', 'app.db')

interface CronRow {
  id: string
  name: string
  schedule: string
  goal: string | null
  command: string | null
  active: number
  next_run_at: string | null
  run_count: number
}

/** Parse a cron schedule string and compute the next fire time after `from`. */
function nextCronAfter(schedule: string, from: Date): Date | null {
  try {
    // We only support simple interval expressions: @every Xm, @daily, @hourly
    // For full cron syntax we'd need a library — keep it dependency-free for now.
    const lower = schedule.toLowerCase().trim()

    if (lower === '@daily') {
      const d = new Date(from)
      d.setDate(d.getDate() + 1)
      d.setHours(8, 0, 0, 0)
      return d
    }

    if (lower === '@hourly') {
      const d = new Date(from)
      d.setHours(d.getHours() + 1, 0, 0, 0)
      return d
    }

    // @every 30m / @every 1h / @every 2h etc.
    const everyMatch = lower.match(/^@every\s+(\d+)(m|h)$/)
    if (everyMatch) {
      const amount = parseInt(everyMatch[1]!, 10)
      const unit = everyMatch[2]!
      const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 60 * 1000
      return new Date(from.getTime() + ms)
    }

    // Standard 5-field cron — compute next occurrence naively (minute precision)
    // Format: "min hour dom month dow"
    const parts = schedule.split(/\s+/)
    if (parts.length === 5) {
      return parseStandardCron(parts, from)
    }

    return null
  } catch {
    return null
  }
}

function parseStandardCron(parts: string[], from: Date): Date | null {
  const [minPart, hourPart] = parts
  // Only handle simple "minute hour * * *" style for now
  const min = minPart === '*' ? null : parseInt(minPart!, 10)
  const hour = hourPart === '*' ? null : parseInt(hourPart!, 10)

  if (min === null && hour === null) return null

  const candidate = new Date(from)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1) // at least 1 minute into the future

  for (let i = 0; i < 1440; i++) {
    const m = candidate.getMinutes()
    const h = candidate.getHours()
    if ((min === null || m === min) && (hour === null || h === hour)) {
      return candidate
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  return null
}

/** Fire a single cron job: run the goal/command through the orchestrator */
async function fireCron(cron: CronRow, orchestrator: AgentOrchestrator): Promise<void> {
  const goal = cron.goal ?? cron.command ?? cron.name
  emitLog({ level: 'info', agentId: 'system', message: `[heartbeat] firing cron "${cron.name}"` })

  try {
    const settings = loadSettings()
    const agentHandle = 'greg'
    const result = await orchestrator.runTurn({
      agent: {
        id: agentHandle,
        handle: agentHandle,
        systemPrompt: settings.userProfile?.customNotes ?? '',
        model: 'auto',
        timezone: settings.userProfile?.timezone ?? process.env['TZ'] ?? 'UTC',
      },
      message: `[Scheduled task: ${cron.name}] ${goal}`,
      threadId: `cron-${cron.id}`,
      resourceId: 'cron',
    })

    // Notify the user via Telegram
    await sendTelegramNotification(`✅ *${cron.name}* completed:\n${result.content.slice(0, 800)}`)
  } catch (err) {
    emitLog({
      level: 'error',
      agentId: 'system',
      message: `[heartbeat] cron "${cron.name}" failed: ${String(err)}`,
    })
    await sendTelegramNotification(`❌ *${cron.name}* failed: ${String(err)}`)
  }
}

/** Update cron run stats in SQLite */
function markCronRan(id: string, status: 'success' | 'failed', nextRunAt: string | null): void {
  try {
    const db = new Database(DB_PATH)
    db.prepare(
      `UPDATE crons SET last_run_at = ?, last_run_status = ?, next_run_at = ?,
       run_count = run_count + 1 WHERE id = ?`,
    ).run(new Date().toISOString(), status, nextRunAt, id)
    db.close()
  } catch {
    // best-effort
  }
}

/** Check and fire overdue crons */
async function tickCrons(orchestrator: AgentOrchestrator): Promise<void> {
  let db: InstanceType<typeof Database> | null = null
  try {
    db = new Database(DB_PATH, { readonly: true })
  } catch {
    return // DB not ready yet
  }

  const now = new Date()
  const rows = db.prepare('SELECT * FROM crons WHERE active = 1').all() as CronRow[]
  db.close()

  for (const cron of rows) {
    const nextRun = cron.next_run_at ? new Date(cron.next_run_at) : null

    // If no next_run_at, compute it and store it without firing
    if (!nextRun) {
      const computed = nextCronAfter(cron.schedule, now)
      if (computed) {
        markCronRan(cron.id, 'success', computed.toISOString())
        // Don't actually do .run_count++ here — just set next time
        const patchDb = new Database(DB_PATH)
        patchDb
          .prepare('UPDATE crons SET next_run_at = ? WHERE id = ?')
          .run(computed.toISOString(), cron.id)
        patchDb.close()
      }
      continue
    }

    // Fire if overdue
    if (nextRun <= now) {
      const next = nextCronAfter(cron.schedule, now)
      let status: 'success' | 'failed' = 'success'
      try {
        await fireCron(cron, orchestrator)
      } catch {
        status = 'failed'
      }
      markCronRan(cron.id, status, next?.toISOString() ?? null)
    }
  }
}

/** Send the periodic heartbeat check-in */
async function heartbeatCheckIn(orchestrator: AgentOrchestrator): Promise<void> {
  emitLog({ level: 'info', agentId: 'system', message: '[heartbeat] waking up for check-in' })

  const settings = loadSettings()
  const now = new Date().toLocaleString('en-US', {
    timeZone: settings.userProfile?.timezone ?? 'UTC',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  try {
    const result = await orchestrator.runTurn({
      agent: {
        id: 'greg',
        handle: 'greg',
        systemPrompt: '',
        model: 'auto',
        timezone: settings.userProfile?.timezone ?? process.env['TZ'] ?? 'UTC',
      },
      message: `[Heartbeat check-in — ${now}]
You're waking up on your own schedule to check in with the user. Review your journal and pending goals.
If there's anything worth surfacing — something you noticed, a task that's due, a pattern you've spotted — send a brief, natural message to the user via notify_user. Keep it under 3 sentences. If there's genuinely nothing interesting, stay quiet.`,
      threadId: 'heartbeat',
      resourceId: 'system',
    })

    // Only send if the agent actually produced a meaningful response
    const content = result.content.trim()
    if (content && content.length > 10) {
      await sendTelegramNotification(content)
    }
  } catch (err) {
    emitLog({
      level: 'error',
      agentId: 'system',
      message: `[heartbeat] check-in failed: ${String(err)}`,
    })
  }
}

// ---------------------------------------------------------------------------
// Scheduler singleton
// ---------------------------------------------------------------------------

let cronIntervalId: ReturnType<typeof setInterval> | null = null
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null
let ollamaWarmIntervalId: ReturnType<typeof setInterval> | null = null
let orchestratorRef: AgentOrchestrator | null = null

/**
 * Ping Ollama to keep the model loaded in RAM.
 * Sends an empty keep_alive request — no generation, no tokens burned.
 */
async function warmOllama(): Promise<void> {
  const ollamaUrl =
    process.env['OLLAMA_BASE_URL'] ?? process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
  const model = process.env['OLLAMA_MODEL'] ?? 'llama3.2'
  try {
    await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', keep_alive: '25m' }),
      signal: AbortSignal.timeout(10_000),
    })
    emitLog({
      level: 'info',
      agentId: 'system',
      message: `[heartbeat] ollama keepalive sent (${model})`,
    })
  } catch {
    // non-fatal — ollama may not be running
  }
}

/**
 * Start the heartbeat scheduler.
 * @param heartbeatIntervalMinutes How often to do a proactive check-in (default: 30).
 */
export function startHeartbeat(heartbeatIntervalMinutes = 30): void {
  if (cronIntervalId) return // already running

  orchestratorRef = new AgentOrchestrator()

  // Warm Ollama immediately on startup, then every 20 minutes
  void warmOllama()
  ollamaWarmIntervalId = setInterval(() => void warmOllama(), 20 * 60 * 1000)

  // Cron tick: every 60 seconds
  cronIntervalId = setInterval(() => {
    if (orchestratorRef) tickCrons(orchestratorRef).catch(() => {})
  }, 60_000)

  // Heartbeat check-in
  const heartbeatMs = heartbeatIntervalMinutes * 60 * 1000
  heartbeatIntervalId = setInterval(() => {
    if (orchestratorRef) heartbeatCheckIn(orchestratorRef).catch(() => {})
  }, heartbeatMs)

  emitLog({
    level: 'info',
    agentId: 'system',
    message: `[heartbeat] started — cron tick every 60s, check-in every ${heartbeatIntervalMinutes}m, ollama keepalive every 20m`,
  })
}

export function stopHeartbeat(): void {
  if (cronIntervalId) {
    clearInterval(cronIntervalId)
    cronIntervalId = null
  }
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId)
    heartbeatIntervalId = null
  }
  if (ollamaWarmIntervalId) {
    clearInterval(ollamaWarmIntervalId)
    ollamaWarmIntervalId = null
  }
  orchestratorRef = null
}
