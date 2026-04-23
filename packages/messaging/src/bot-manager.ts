/**
 * BotManager
 *
 * Manages the lifecycle of all messaging bot adapters.
 * - Reads credentials from the SQLite plugin_credentials table at startup
 * - Routes incoming messages to the agent orchestrator via HTTP
 * - Exposes start/stop/status API for the control-plane
 *
 * Adding a new channel later:
 *   1. Add a createXxxAdapter() in its own file
 *   2. Add a case in _buildAdapter()
 *   3. That's it — everything else is shared
 */

import type { BotAdapter, IncomingMessage, RouterConfig } from './index.js'
import { routeMessage } from './index.js'
import { createTelegramAdapter } from './telegram.js'
import { createDiscordAdapter } from './discord.js'

export type ChannelId = 'telegram' | 'discord'

export interface BotStatus {
  channel: ChannelId
  running: boolean
  startedAt?: string
  error?: string
}

interface CredentialRow {
  plugin_id: string
  fields: string
}

interface AgentRow {
  handle: string
  id?: number
}

/**
 * Minimal SQLite interface — we accept the better-sqlite3 Database object
 * typed loosely so the messaging package doesn't need to depend on it.
 */
export interface SqliteDb {
  prepare(sql: string): { all(): unknown[]; get(): unknown }
}

/**
 * Called for every agent message. Hits the control-plane /api/chat endpoint.
 */
export type MessageDispatcher = (params: {
  agentId: string
  message: string
  chatId: string
  channel: ChannelId
  threadId: string
}) => Promise<string>

interface ManagedBot {
  channel: ChannelId
  adapter: BotAdapter
  startedAt?: string
  error?: string
}

export class BotManager {
  private bots = new Map<ChannelId, ManagedBot>()
  private dispatcher: MessageDispatcher
  private routerConfig: RouterConfig

  constructor(dispatcher: MessageDispatcher) {
    this.dispatcher = dispatcher
    this.routerConfig = { agents: {}, defaultAgentId: 'greg' }
  }

  /** Load agent handles from DB and refresh the router table */
  refreshAgents(db: SqliteDb) {
    const rows = db.prepare('SELECT handle FROM agents').all() as AgentRow[]
    const agents: Record<string, string> = {}
    for (const row of rows) {
      agents[row.handle] = row.handle
    }
    this.routerConfig = { agents, defaultAgentId: 'greg' }
  }

  /** Start all configured bots based on plugin_credentials in the DB */
  async startAll(db: SqliteDb) {
    this.refreshAgents(db)

    const rows = db
      .prepare('SELECT plugin_id, fields FROM plugin_credentials')
      .all() as CredentialRow[]

    for (const row of rows) {
      const channelId = this._pluginToChannel(row.plugin_id)
      if (!channelId) continue

      let fields: Record<string, string>
      try {
        fields = JSON.parse(row.fields) as Record<string, string>
      } catch {
        continue
      }

      await this._startChannel(channelId, fields)
    }
  }

  /** Start or restart a single channel (called when credentials are saved in UI) */
  async startChannel(channelId: ChannelId, fields: Record<string, string>) {
    // Stop existing instance first
    await this.stopChannel(channelId)
    await this._startChannel(channelId, fields)
  }

  async stopChannel(channelId: ChannelId) {
    const bot = this.bots.get(channelId)
    if (!bot) return
    try {
      await bot.adapter.stop()
    } catch {
      // ignore
    }
    this.bots.delete(channelId)
  }

  async stopAll() {
    for (const channelId of this.bots.keys()) {
      await this.stopChannel(channelId)
    }
  }

  status(): BotStatus[] {
    const result: BotStatus[] = []
    const channels: ChannelId[] = ['telegram', 'discord']
    for (const channel of channels) {
      const bot = this.bots.get(channel)
      const entry: BotStatus = {
        channel,
        running: !!bot && !bot.error,
      }
      if (bot?.startedAt) entry.startedAt = bot.startedAt
      if (bot?.error) entry.error = bot.error
      result.push(entry)
    }
    return result
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _startChannel(channelId: ChannelId, fields: Record<string, string>) {
    let adapter: BotAdapter
    try {
      adapter = this._buildAdapter(channelId, fields)
    } catch (err) {
      this.bots.set(channelId, {
        channel: channelId,
        adapter: null as unknown as BotAdapter,
        error: String(err),
      })
      return
    }

    const bot: ManagedBot = { channel: channelId, adapter }

    adapter.onMessage(async (msg: IncomingMessage) => {
      const routed = routeMessage(msg, this.routerConfig)
      const agentId = routed?.agentId ?? 'greg'
      const threadId = `${channelId}-${msg.chatId}`

      let reply: string
      try {
        reply = await this.dispatcher({
          agentId,
          message: msg.text,
          chatId: msg.chatId,
          channel: channelId,
          threadId,
        })
      } catch (err) {
        reply = `Error: ${String(err)}`
      }

      try {
        await adapter.send({ chatId: msg.chatId, text: reply, replyToId: msg.id })
      } catch {
        // log but don't crash the bot
      }
    })

    try {
      await adapter.start()
      bot.startedAt = new Date().toISOString()
      this.bots.set(channelId, bot)
    } catch (err) {
      bot.error = String(err)
      this.bots.set(channelId, bot)
    }
  }

  private _buildAdapter(channelId: ChannelId, fields: Record<string, string>): BotAdapter {
    switch (channelId) {
      case 'telegram': {
        const token = fields['bot_token']
        if (!token) throw new Error('Telegram bot_token is required')
        const allowedRaw = fields['allowed_chat_ids'] ?? ''
        const allowedChatIds = allowedRaw
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
        return createTelegramAdapter({ token, allowedChatIds })
      }
      case 'discord': {
        const token = fields['bot_token']
        if (!token) throw new Error('Discord bot_token is required')
        const guildId = fields['guild_id']
        return createDiscordAdapter(guildId ? { token, guildId } : { token })
      }
    }
  }

  private _pluginToChannel(pluginId: string): ChannelId | null {
    if (pluginId === 'telegram') return 'telegram'
    if (pluginId === 'discord') return 'discord'
    return null
  }
}
