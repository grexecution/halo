import type { Message } from '@open-greg/agent-core'

interface SessionStoreOptions {
  dryRun?: boolean | undefined
}

export class SessionStore {
  private dryRun: boolean
  private sessions: Map<string, Message[]> = new Map()

  constructor(opts: SessionStoreOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  async appendMessage(sessionId: string, message: Message): Promise<void> {
    if (this.dryRun) {
      const existing = this.sessions.get(sessionId) ?? []
      existing.push(message)
      this.sessions.set(sessionId, existing)
      return
    }
    // Real DB path — implemented when Drizzle/Postgres is wired up
    throw new Error('DB path not yet implemented — use dryRun: true')
  }

  async getHistory(sessionId: string): Promise<Message[]> {
    if (this.dryRun) {
      return [...(this.sessions.get(sessionId) ?? [])]
    }
    throw new Error('DB path not yet implemented — use dryRun: true')
  }
}
