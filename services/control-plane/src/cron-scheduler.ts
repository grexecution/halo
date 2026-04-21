interface CronJobInput {
  name: string
  cron: string
  taskType: string
}

interface CronJob {
  id: string
  name: string
  cron: string
  taskType: string
  active: boolean
  createdAt: string
}

interface CronSchedulerOptions {
  dryRun?: boolean | undefined
}

export class CronScheduler {
  private dryRun: boolean
  private jobs: Map<string, CronJob> = new Map()
  private counter = 0

  constructor(opts: CronSchedulerOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  async addJob(input: CronJobInput): Promise<CronJob> {
    const job: CronJob = {
      id: `job-${++this.counter}`,
      name: input.name,
      cron: input.cron,
      taskType: input.taskType,
      active: true,
      createdAt: new Date().toISOString(),
    }
    this.jobs.set(job.id, job)
    return job
  }

  async listJobs(): Promise<CronJob[]> {
    return [...this.jobs.values()]
  }

  async getJob(id: string): Promise<CronJob | undefined> {
    return this.jobs.get(id)
  }

  async pauseJob(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (job) job.active = false
  }

  async resumeJob(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (job) job.active = true
  }
}
