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

const DB_PATH = join(homedir(), '.open-greg', 'app.db')

let manager: BotManager | null = null

/** Called once from index.ts at startup */
export async function initMessaging() {
  let db: InstanceType<typeof Database>
  try {
    db = new Database(DB_PATH, { readonly: true })
  } catch {
    // DB not created yet (fresh install) — skip quietly
    return
  }

  const orchestrator = new AgentOrchestrator()

  const dispatcher = async (params: {
    agentId: string
    message: string
    chatId: string
    channel: ChannelId
    threadId: string
  }) => {
    emitLog({
      level: 'info',
      agentId: params.agentId,
      message: `[${params.channel}] incoming from chat ${params.chatId}: ${params.message.slice(0, 80)}`,
    })

    const result = await orchestrator.runTurn({
      agent: {
        id: params.agentId,
        handle: params.agentId,
        systemPrompt: '',
        model: 'auto',
        timezone: process.env['TZ'] ?? 'UTC',
      },
      message: params.message,
      threadId: params.threadId,
      resourceId: params.channel,
    })

    return result.content
  }

  manager = new BotManager(dispatcher)

  try {
    await manager.startAll(db)
    const running = manager.status().filter((s) => s.running)
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
  return manager?.status() ?? []
}

/**
 * Reload a single channel after credentials change in the UI.
 * Called by the /api/messaging/reload endpoint.
 */
export async function reloadChannel(channelId: ChannelId, fields: Record<string, string>) {
  if (!manager) return
  await manager.startChannel(channelId, fields)
}
