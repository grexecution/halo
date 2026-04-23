import { Bot, type Context } from 'grammy'
import type { BotAdapter, IncomingMessage, OutgoingMessage } from './index.js'

export interface TelegramAdapterOptions {
  token: string
  /** If set, only these chat IDs can send messages */
  allowedChatIds?: number[]
}

export function createTelegramAdapter(opts: TelegramAdapterOptions): BotAdapter {
  const bot = new Bot(opts.token)
  const handlers: Array<(msg: IncomingMessage) => Promise<void>> = []

  const toIncoming = (ctx: Context): IncomingMessage | null => {
    const msg = ctx.message
    if (!msg?.text) return null

    const chatId = String(msg.chat.id)
    const userId = String(msg.from?.id ?? msg.chat.id)

    if (opts.allowedChatIds && opts.allowedChatIds.length > 0) {
      if (!opts.allowedChatIds.includes(msg.chat.id)) {
        return null // silently ignore unauthorised senders
      }
    }

    return {
      id: String(msg.message_id),
      channel: 'telegram',
      chatId,
      userId,
      text: msg.text,
      handle: msg.from?.username,
      isGroup: msg.chat.type !== 'private',
      timestamp: new Date(msg.date * 1000).toISOString(),
    }
  }

  bot.on('message:text', async (ctx) => {
    const incoming = toIncoming(ctx)
    if (!incoming) return
    for (const h of handlers) await h(incoming)
  })

  return {
    async send(msg: OutgoingMessage) {
      const extra: Parameters<typeof bot.api.sendMessage>[2] = { parse_mode: 'Markdown' }
      if (msg.replyToId) extra.reply_parameters = { message_id: Number(msg.replyToId) }
      await bot.api.sendMessage(Number(msg.chatId), msg.text, extra)
    },

    onMessage(handler: (msg: IncomingMessage) => Promise<void>) {
      handlers.push(handler)
    },

    async start() {
      // long-polling — works behind NAT, no public URL needed
      void bot.start({
        onStart: () => {},
        drop_pending_updates: false,
      })
    },

    async stop() {
      await bot.stop()
    },
  }
}
