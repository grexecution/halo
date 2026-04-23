export type { TelegramAdapterOptions } from './telegram.js'
export { createTelegramAdapter } from './telegram.js'
export type { DiscordAdapterOptions } from './discord.js'
export { createDiscordAdapter } from './discord.js'
export type { BotStatus, ChannelId, SqliteDb, MessageDispatcher } from './bot-manager.js'
export { BotManager } from './bot-manager.js'

export type MessageChannel = 'telegram' | 'discord' | 'slack'

export interface IncomingMessage {
  id: string
  channel: MessageChannel
  chatId: string
  userId: string
  text: string
  handle?: string | undefined
  isGroup?: boolean | undefined
  timestamp: string
}

export interface OutgoingMessage {
  chatId: string
  text: string
  replyToId?: string | undefined
}

export interface RouterConfig {
  agents: Record<string, string>
  defaultAgentId?: string | undefined
}

export interface RoutedMessage {
  agentId: string
  message: IncomingMessage
  reason: 'mention' | 'direct' | 'default'
}

export function routeMessage(msg: IncomingMessage, config: RouterConfig): RoutedMessage | null {
  const { agents, defaultAgentId } = config

  // Check for @handle mention in text
  const mentionMatch = msg.text.match(/@(\w+)/)
  if (mentionMatch) {
    const handle = mentionMatch[1] ?? ''
    const agentId = agents[handle]
    if (agentId) {
      return { agentId, message: msg, reason: 'mention' }
    }
  }

  // Direct message (non-group)
  if (!msg.isGroup && defaultAgentId) {
    return { agentId: defaultAgentId, message: msg, reason: 'direct' }
  }

  // Group message without mention
  if (msg.isGroup && defaultAgentId) {
    return { agentId: defaultAgentId, message: msg, reason: 'default' }
  }

  return null
}

export interface BotAdapter {
  send(msg: OutgoingMessage): Promise<void>
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void
  start(): Promise<void>
  stop(): Promise<void>
}

export function createMockAdapter(): BotAdapter {
  const handlers: Array<(msg: IncomingMessage) => Promise<void>> = []
  const sent: OutgoingMessage[] = []

  return {
    async send(msg: OutgoingMessage) {
      sent.push(msg)
    },
    onMessage(handler: (msg: IncomingMessage) => Promise<void>) {
      handlers.push(handler)
    },
    async start() {},
    async stop() {},
    // Expose for testing
    _sent: sent,
    _handlers: handlers,
    _trigger: async (msg: IncomingMessage) => {
      for (const h of handlers) await h(msg)
    },
  } as unknown as BotAdapter
}
