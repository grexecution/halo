interface ServiceStatus {
  [service: string]: string
}

interface HealthResult {
  status: 'healthy' | 'degraded' | 'down'
  services: ServiceStatus
}

interface ErrorEntry {
  message: string
  timestamp: string
  service?: string | undefined
}

interface SelfDiagnoseOptions {
  dryRun?: boolean | undefined
  simulateDown?: string[] | undefined
  simulateErrors?: string[] | undefined
}

export class SelfDiagnoseTools {
  private simulateDown: string[]
  private simulateErrors: string[]

  constructor(opts: SelfDiagnoseOptions = {}) {
    this.simulateDown = opts.simulateDown ?? []
    this.simulateErrors = opts.simulateErrors ?? []
  }

  async health_check(): Promise<HealthResult> {
    const knownServices = ['browser-service', 'vision-service', 'control-plane', 'memory-service']
    const services: ServiceStatus = {}
    let hasDown = false

    for (const svc of knownServices) {
      if (this.simulateDown.includes(svc)) {
        services[svc] = 'down'
        hasDown = true
      } else {
        services[svc] = 'ok'
      }
    }

    return {
      status: hasDown ? 'degraded' : 'healthy',
      services,
    }
  }

  async recent_errors(): Promise<ErrorEntry[]> {
    return this.simulateErrors.map((msg) => ({
      message: msg,
      timestamp: new Date().toISOString(),
    }))
  }
}
