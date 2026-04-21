/**
 * F-133: Approval flow (Telegram)
 */
import { describe, it, expect } from 'vitest'
import { createTelegramApprovalRequest, type ApprovalRequest } from '../src/telegram-approval.js'

describe('F-133: Approval flow (Telegram)', () => {
  it('creates inline keyboard message for approval request', () => {
    const req: ApprovalRequest = {
      requestId: 'req-001',
      action: 'email.send',
      description: 'Send email to alice@example.com',
      timeoutSeconds: 300,
    }
    const msg = createTelegramApprovalRequest(req)
    expect(msg.text).toContain('email.send')
    expect(msg.reply_markup.inline_keyboard).toHaveLength(1)
  })

  it('includes Allow and Deny buttons in the keyboard', () => {
    const req: ApprovalRequest = {
      requestId: 'req-002',
      action: 'shell.exec',
      description: 'Execute: rm -rf /tmp/old',
      timeoutSeconds: 300,
    }
    const msg = createTelegramApprovalRequest(req)
    const row = msg.reply_markup.inline_keyboard[0]
    expect(row).toBeDefined()
    const labels = (row ?? []).map((btn: { text: string }) => btn.text)
    expect(labels).toContain('Allow')
    expect(labels).toContain('Deny')
  })

  it('embeds request ID in callback data', () => {
    const req: ApprovalRequest = {
      requestId: 'req-003',
      action: 'fs.write',
      description: 'Write to /etc/hosts',
      timeoutSeconds: 300,
    }
    const msg = createTelegramApprovalRequest(req)
    const row = msg.reply_markup.inline_keyboard[0] ?? []
    const callbackData = row.map((btn: { callback_data: string }) => btn.callback_data)
    expect(callbackData.some((d: string) => d.includes('req-003'))).toBe(true)
  })
})
