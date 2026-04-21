/**
 * F-112: Notification routing
 */
import { describe, it, expect } from 'vitest'
import { NotificationRouter } from '../src/notifications.js'

describe('F-112: Notification routing', () => {
  it('routes goal completion to default channel', async () => {
    const router = new NotificationRouter({ dryRun: true, defaultChannel: 'telegram' })
    const sent = await router.notify({
      type: 'goal_complete',
      title: 'Goal finished',
      body: 'Task: Write report — completed successfully.',
    })
    expect(sent.channel).toBe('telegram')
    expect(sent.delivered).toBe(true)
  })

  it('routes cron completion notification', async () => {
    const router = new NotificationRouter({ dryRun: true, defaultChannel: 'telegram' })
    const sent = await router.notify({
      type: 'cron_complete',
      title: 'Daily summary ready',
      body: 'Your daily summary has been generated.',
    })
    expect(sent.type).toBe('cron_complete')
    expect(sent.delivered).toBe(true)
  })

  it('uses overridden channel when specified', async () => {
    const router = new NotificationRouter({ dryRun: true, defaultChannel: 'telegram' })
    const sent = await router.notify({
      type: 'goal_complete',
      title: 'Test notification',
      body: 'This is a test.',
      channel: 'slack',
    })
    expect(sent.channel).toBe('slack')
  })
})
