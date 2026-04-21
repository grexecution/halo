interface ServiceStatus {
  [service: string]: string
}

interface HealthStatus {
  healthy: boolean
  services: ServiceStatus
}

interface SelfHealthOptions {
  dryRun?: boolean | undefined
  simulateDown?: string[] | undefined
}

export class SelfHealthChecker {
  private dryRun: boolean
  private simulateDown: string[]

  constructor(opts: SelfHealthOptions = {}) {
    this.dryRun = opts.dryRun ?? false
    this.simulateDown = opts.simulateDown ?? []
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.dryRun) {
      throw new Error('Real health check requires running services')
    }

    const knownServices = ['browser-service', 'vision-service', 'control-plane', 'memory-service']
    const services: ServiceStatus = {}
    let healthy = true

    for (const svc of knownServices) {
      if (this.simulateDown.includes(svc)) {
        services[svc] = 'unavailable'
        healthy = false
      } else {
        services[svc] = 'ok'
      }
    }

    return { healthy, services }
  }

  async recentErrors(): Promise<Array<{ message: string; timestamp: string }>> {
    if (!this.dryRun) {
      throw new Error('Real error log requires running services')
    }
    return []
  }
}
