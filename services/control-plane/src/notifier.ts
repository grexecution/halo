/**
 * Notifier — thin wrapper for proactive outbound Telegram messages.
 *
 * Reads the Telegram bot token + chat ID from the persisted settings so the
 * agent can send notifications without a user-initiated conversation.
 *
 * The chat ID is stored as `telegram.defaultChatId` in settings. If not set,
 * we fall back to the TELEGRAM_CHAT_ID env var. If neither is available the
 * send is a no-op (logged, not thrown).
 */

import { loadSettings } from './setup-store.js'

interface TelegramSendParams {
  token: string
  chatId: string
  text: string
}

async function telegramSend({ token, chatId, text }: TelegramSendParams): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`)
  }
}

/**
 * Send a notification to the configured Telegram chat.
 * Silently no-ops if no token or chat ID is configured.
 */
export async function sendTelegramNotification(text: string): Promise<void> {
  const settings = loadSettings()
  const token = settings.telegram?.botToken ?? process.env['TELEGRAM_BOT_TOKEN']
  const chatId =
    settings.telegram?.defaultChatId ??
    process.env['TELEGRAM_CHAT_ID'] ??
    process.env['TELEGRAM_DEFAULT_CHAT_ID']

  if (!token || !chatId) {
    // Telegram not configured — skip silently
    return
  }

  await telegramSend({ token, chatId, text })
}
