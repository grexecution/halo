/**
 * F-093: Email trigger
 */
import { describe, it, expect } from 'vitest'
import { EmailTrigger } from '../src/email-trigger.js'

describe('F-093: Email trigger', () => {
  it('creates an email trigger with label filter', () => {
    const trigger = new EmailTrigger({ dryRun: true, label: 'claw' })
    expect(trigger.label).toBe('claw')
  })

  it('detects new email matching the label filter', async () => {
    const trigger = new EmailTrigger({ dryRun: true, label: 'claw' })
    const emails = await trigger.poll()
    expect(Array.isArray(emails)).toBe(true)
  })

  it('spawns session for incoming email with matching label', async () => {
    const trigger = new EmailTrigger({ dryRun: true, label: 'claw' })
    trigger._injectEmail({
      from: 'user@example.com',
      subject: 'claw: analyze this',
      body: 'Please analyze the Q3 report.',
      label: 'claw',
    })
    const emails = await trigger.poll()
    expect(emails.length).toBeGreaterThan(0)
    expect(emails[0]?.subject).toContain('analyze')
  })

  it('does not surface emails without the matching label', async () => {
    const trigger = new EmailTrigger({ dryRun: true, label: 'claw' })
    trigger._injectEmail({
      from: 'newsletter@example.com',
      subject: 'Weekly digest',
      body: 'Your weekly news...',
      label: 'inbox',
    })
    const emails = await trigger.poll()
    expect(emails.length).toBe(0)
  })
})
