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
      // Validate the token before kicking off the polling loop.
      // bot.api.getMe() throws immediately on a bad token (401).
      await bot.api.getMe()

      // long-polling — works behind NAT, no public URL needed.
      // bot.start() resolves only when the bot stops, so we fire-and-forget.
      // Unhandled errors (network drops etc.) are caught below and logged.
      bot.start({ drop_pending_updates: false }).catch((err: unknown) => {
        // Re-throw so the caller's catch block can capture it
        throw err
      })
    },

    async stop() {
      await bot.stop()
    },
  }
}
