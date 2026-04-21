/**
 * F-074: Telegram voice round-trip
 */
import { describe, it, expect } from 'vitest'
import { createTelegramVoiceHandler, type VoiceMessage } from '../src/telegram-voice.js'

describe('F-074: Telegram voice round-trip', () => {
  it('creates a voice handler', () => {
    const handler = createTelegramVoiceHandler({ dryRun: true })
    expect(handler).toBeDefined()
  })

  it('processes incoming voice message and returns transcript', async () => {
    const handler = createTelegramVoiceHandler({ dryRun: true })
    const msg: VoiceMessage = {
      chatId: 12345,
      fileId: 'file_abc123',
      duration: 5,
    }
    const result = await handler.processVoice(msg)
    expect(result.transcript).toBeTruthy()
    expect(result.chatId).toBe(12345)
  })

  it('returns voice reply when agent response is generated', async () => {
    const handler = createTelegramVoiceHandler({ dryRun: true })
    const msg: VoiceMessage = {
      chatId: 99999,
      fileId: 'file_xyz',
      duration: 3,
    }
    const result = await handler.processVoice(msg)
    expect(result.voiceReply).toBe(true)
  })
})
