export interface VoiceMessage {
  chatId: number
  fileId: string
  duration: number
}

interface VoiceProcessResult {
  chatId: number
  transcript: string
  voiceReply: boolean
}

interface TelegramVoiceHandlerOptions {
  dryRun?: boolean | undefined
}

interface TelegramVoiceHandler {
  processVoice(msg: VoiceMessage): Promise<VoiceProcessResult>
}

export function createTelegramVoiceHandler(
  opts: TelegramVoiceHandlerOptions = {},
): TelegramVoiceHandler {
  const dryRun = opts.dryRun ?? false

  return {
    async processVoice(msg: VoiceMessage): Promise<VoiceProcessResult> {
      if (!dryRun) {
        throw new Error('Real Telegram voice requires STT service and bot token')
      }
      return {
        chatId: msg.chatId,
        transcript: `[transcribed audio from file ${msg.fileId}, ${msg.duration}s]`,
        voiceReply: true,
      }
    },
  }
}
