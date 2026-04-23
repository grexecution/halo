/**
 * Messaging bridge — connects BotManager to the control-plane orchestrator.
 *
 * Reads plugin_credentials from SQLite (same DB as the dashboard), starts
 * all configured chat bots (Telegram first, Discord stub ready), and routes
 * every incoming message through AgentOrchestrator.
 *
 * The bridge is a singleton — call initMessaging() once at startup,
 * getMessagingStatus() for health checks, and shutdownMessaging() on exit.
 */

import Database from 'better-sqlite3'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BotManager } from '@open-greg/messaging'
import type { ChannelId } from '@open-greg/messaging'
import { AgentOrchestrator } from './orchestrator.js'
import { emitLog } from './log-store.js'
import { chatBus } from './chat-bus.js'

interface AgentRow {
  handle: string
  model: string
  system_prompt: string
}

/** Read a single agent config from the DB by handle. Returns null if not found. */
function readAgentConfig(agentId: string): { model: string; systemPrompt: string } | null {
  try {
    const db = new Database(DB_PATH, { readonly: true })
    const row = db
      .prepare('SELECT handle, model, system_prompt FROM agents WHERE handle = ?')
      .get(agentId) as AgentRow | undefined
    db.close()
    if (!row) return null
    return { model: row.model, systemPrompt: row.system_prompt ?? '' }
  } catch {
    return null
  }
}

const DB_PATH = join(homedir(), '.open-greg', 'app.db')

let manager: BotManager | null = null

function buildOrchestrator() {
  return new AgentOrchestrator()
}

function buildDispatcher(orchestrator: AgentOrchestrator) {
  return async (params: {
    agentId: string
    message: string
    chatId: string
    channel: ChannelId
    threadId: string
    senderName?: string
  }) => {
    const source = params.channel as 'telegram' | 'discord'

    emitLog({
      level: 'info',
      agentId: params.agentId,
      message: `[${params.channel}] incoming from chat ${params.chatId}: ${params.message.slice(0, 80)}`,
    })

    // Publish the incoming user message to the dashboard
    chatBus.publish({
      threadId: params.threadId,
      role: 'user',
      content: params.message,
      source,
      senderName: params.senderName ?? params.chatId,
      timestamp: new Date().toISOString(),
    })

    // Look up the agent's config from DB so the right system prompt + model is used.
    const agentConfig = readAgentConfig(params.agentId)

    const result = await orchestrator.runTurn({
      agent: {
        id: params.agentId,
        handle: params.agentId,
        systemPrompt: agentConfig?.systemPrompt ?? '',
        model: agentConfig?.model ?? 'auto',
        timezone: process.env['TZ'] ?? 'UTC',
      },
      message: params.message,
      threadId: params.threadId,
      resourceId: params.channel,
    })

    // Publish the agent reply back to the dashboard
    chatBus.publish({
      threadId: params.threadId,
      role: 'assistant',
      content: result.content,
      source: 'system',
      senderName: params.agentId,
      timestamp: new Date().toISOString(),
    })

    return result.content
  }
}

/** Lazily create the manager singleton (safe to call multiple times) */
function ensureManager(): BotManager {
  if (!manager) {
    const orchestrator = buildOrchestrator()
    manager = new BotManager(buildDispatcher(orchestrator))
  }
  return manager
}

/** Called once from index.ts at startup */
export async function initMessaging() {
  let db: InstanceType<typeof Database>
  try {
    db = new Database(DB_PATH, { readonly: true })
  } catch {
    // DB not created yet (fresh install) — skip quietly; manager stays null
    // until first hot-reload via reloadChannel()
    return
  }

  const m = ensureManager()

  try {
    await m.startAll(db)
    const running = m.status().filter((s) => s.running)
    if (running.length > 0) {
      emitLog({
        level: 'info',
        agentId: 'system',
        message: `Messaging: started ${running.map((s) => s.channel).join(', ')}`,
      })
    }
  } catch (err) {
    emitLog({ level: 'error', agentId: 'system', message: `Messaging init error: ${String(err)}` })
  } finally {
    db.close()
  }
}

export async function shutdownMessaging() {
  if (manager) {
    await manager.stopAll()
    manager = null
  }
}

export function getMessagingStatus() {
  // If manager was never initialised (no DB yet), return "not connected" for all channels
  return manager?.status() ?? []
}

/**
 * Reload a single channel after credentials change in the UI.
 * Called by the /api/messaging/reload endpoint.
 */
export async function reloadChannel(channelId: ChannelId, fields: Record<string, string>) {
  // ensureManager() works even on first-time connect (manager was null)
  const m = ensureManager()
  await m.startChannel(channelId, fields)
}
