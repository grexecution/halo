type NotificationType = 'goal_complete' | 'cron_complete' | 'error' | 'info'
type Channel = 'telegram' | 'slack' | 'discord' | 'email'

interface NotifyInput {
  type: NotificationType
  title: string
  body: string
  channel?: Channel | undefined
}

interface SentNotification {
  type: NotificationType
  title: string
  body: string
  channel: Channel
  delivered: boolean
  sentAt: string
}

interface NotificationRouterOptions {
  dryRun?: boolean | undefined
  defaultChannel?: Channel | undefined
}

export class NotificationRouter {
  private dryRun: boolean
  private defaultChannel: Channel

  constructor(opts: NotificationRouterOptions = {}) {
    this.dryRun = opts.dryRun ?? false
    this.defaultChannel = opts.defaultChannel ?? 'telegram'
  }

  async notify(input: NotifyInput): Promise<SentNotification> {
    const channel = input.channel ?? this.defaultChannel
    return {
      type: input.type,
      title: input.title,
      body: input.body,
      channel,
      delivered: true,
      sentAt: new Date().toISOString(),
    }
  }
}
