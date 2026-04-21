export interface ScrapeResult {
  url: string
  text: string
  title?: string | undefined
}

export interface ActResult {
  success: boolean
  steps: number
  finalUrl?: string | undefined
}

export interface BrowserPoolStatus {
  active: number
  queued: number
  maxConcurrent: number
}

interface BrowserServiceOptions {
  dryRun?: boolean | undefined
  maxConcurrent?: number | undefined
  profileDir?: string | undefined
}

export class BrowserService {
  private dryRun: boolean
  private maxConcurrent: number
  private profileDir: string | undefined
  private activeCount = 0
  private queue: Array<() => void> = []

  constructor(opts: BrowserServiceOptions = {}) {
    this.dryRun = opts.dryRun ?? false
    this.maxConcurrent = opts.maxConcurrent ?? 3
    this.profileDir = opts.profileDir
  }

  async scrape(url: string, _selector?: string): Promise<ScrapeResult> {
    if (this.dryRun) {
      return {
        url,
        text: `[scraped content from ${url}]`,
        title: `Page at ${url}`,
      }
    }
    throw new Error('Real scraping requires Playwright — use dryRun: true for tests')
  }

  async act(goal: string, opts: { persistent?: boolean } = {}): Promise<ActResult> {
    return await this.withSlot(async () => {
      if (this.dryRun) {
        return {
          success: true,
          steps: 1,
          finalUrl: opts.persistent ? `profile:${this.profileDir ?? 'default'}` : undefined,
        }
      }
      throw new Error('Real browser automation requires Playwright — use dryRun: true for tests')
    })
  }

  poolStatus(): BrowserPoolStatus {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    }
  }

  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.activeCount++
    try {
      return await fn()
    } finally {
      this.activeCount--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}
