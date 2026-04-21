interface EmailMessage {
  from: string
  subject: string
  body: string
  label: string
}

interface EmailTriggerOptions {
  dryRun?: boolean | undefined
  label: string
}

export class EmailTrigger {
  readonly label: string
  private dryRun: boolean
  private inbox: EmailMessage[] = []

  constructor(opts: EmailTriggerOptions) {
    this.label = opts.label
    this.dryRun = opts.dryRun ?? false
  }

  _injectEmail(email: EmailMessage): void {
    this.inbox.push(email)
  }

  async poll(): Promise<EmailMessage[]> {
    if (!this.dryRun) {
      throw new Error('Real email polling requires Gmail API credentials')
    }
    const matched = this.inbox.filter((e) => e.label === this.label)
    this.inbox = this.inbox.filter((e) => e.label !== this.label)
    return matched
  }
}
