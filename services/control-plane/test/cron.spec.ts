/**
 * F-110: Cron scheduler
 */
import { describe, it, expect } from 'vitest'
import { CronScheduler } from '../src/cron-scheduler.js'

describe('F-110: Cron scheduler', () => {
  it('creates a repeatable cron job', async () => {
    const scheduler = new CronScheduler({ dryRun: true })
    const job = await scheduler.addJob({
      name: 'daily-summary',
      cron: '0 9 * * *',
      taskType: 'notification',
    })
    expect(job.id).toBeTruthy()
    expect(job.name).toBe('daily-summary')
    expect(job.active).toBe(true)
  })

  it('lists all scheduled jobs', async () => {
    const scheduler = new CronScheduler({ dryRun: true })
    await scheduler.addJob({ name: 'job-a', cron: '*/5 * * * *', taskType: 'check' })
    await scheduler.addJob({ name: 'job-b', cron: '0 * * * *', taskType: 'report' })
    const jobs = await scheduler.listJobs()
    expect(jobs.length).toBeGreaterThanOrEqual(2)
  })

  it('pauses a job to stop it from firing', async () => {
    const scheduler = new CronScheduler({ dryRun: true })
    const job = await scheduler.addJob({ name: 'pauseable', cron: '* * * * *', taskType: 'ping' })
    await scheduler.pauseJob(job.id)
    const updated = await scheduler.getJob(job.id)
    expect(updated?.active).toBe(false)
  })

  it('resumes a paused job', async () => {
    const scheduler = new CronScheduler({ dryRun: true })
    const job = await scheduler.addJob({ name: 'resumeable', cron: '* * * * *', taskType: 'ping' })
    await scheduler.pauseJob(job.id)
    await scheduler.resumeJob(job.id)
    const updated = await scheduler.getJob(job.id)
    expect(updated?.active).toBe(true)
  })
})
