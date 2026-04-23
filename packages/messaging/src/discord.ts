/**
 * Discord adapter stub.
 * Satisfies the BotAdapter interface so the BotManager can accept Discord
 * credentials today. Real implementation: replace with discord.js Client.
 */
import type { BotAdapter, IncomingMessage, OutgoingMessage } from './index.js'

export interface DiscordAdapterOptions {
  token: string
  /** Guild/server ID to scope the bot to */
  guildId?: string
}

export function createDiscordAdapter(_opts: DiscordAdapterOptions): BotAdapter {
  const handlers: Array<(msg: IncomingMessage) => Promise<void>> = []

  return {
    async send(_msg: OutgoingMessage) {
      throw new Error('Discord adapter not yet implemented — add discord.js')
    },
    onMessage(handler: (msg: IncomingMessage) => Promise<void>) {
      handlers.push(handler)
    },
    async start() {
      // No-op: stub
    },
    async stop() {
      // No-op: stub
    },
  }
}
