interface ServiceStatusInfo {
  alive: boolean
  lastSeen?: number | undefined
}

interface WatchdogOptions {
  dryRun?: boolean | undefined
  timeoutMs?: number | undefined
}

type RestartHandler = (serviceName: string) => void

export class Watchdog {
  private dryRun: boolean
  private timeoutMs: number
  private heartbeats: Map<string, number> = new Map()
  private restartHandlers: RestartHandler[] = []

  constructor(opts: WatchdogOptions = {}) {
    this.dryRun = opts.dryRun ?? false
    this.timeoutMs = opts.timeoutMs ?? 90_000
  }

  heartbeat(serviceName: string): void {
    this.heartbeats.set(serviceName, Date.now())
  }

  _setLastHeartbeat(serviceName: string, timestamp: number): void {
    this.heartbeats.set(serviceName, timestamp)
  }

  getServiceStatus(serviceName: string): ServiceStatusInfo {
    const lastSeen = this.heartbeats.get(serviceName)
    if (lastSeen === undefined) return { alive: false }
    const age = Date.now() - lastSeen
    return { alive: age < this.timeoutMs, lastSeen }
  }

  onRestart(handler: RestartHandler): void {
    this.restartHandlers.push(handler)
  }

  check(): void {
    for (const [serviceName, lastSeen] of this.heartbeats) {
      const age = Date.now() - lastSeen
      if (age >= this.timeoutMs) {
        for (const handler of this.restartHandlers) {
          handler(serviceName)
        }
        if (!this.dryRun) {
          // Real restart would happen here
        }
        // Reset heartbeat after restart
        this.heartbeats.set(serviceName, Date.now())
      }
    }
  }
}
