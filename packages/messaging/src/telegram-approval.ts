export interface ApprovalRequest {
  requestId: string
  action: string
  description: string
  timeoutSeconds: number
}

interface InlineKeyboardButton {
  text: string
  callback_data: string
}

interface TelegramApprovalMessage {
  text: string
  reply_markup: {
    inline_keyboard: InlineKeyboardButton[][]
  }
}

export function createTelegramApprovalRequest(req: ApprovalRequest): TelegramApprovalMessage {
  return {
    text: `Action requires approval: *${req.action}*\n\n${req.description}\n\nAuto-deny in ${req.timeoutSeconds}s.`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Allow', callback_data: `approve:${req.requestId}` },
          { text: 'Deny', callback_data: `deny:${req.requestId}` },
        ],
      ],
    },
  }
}
