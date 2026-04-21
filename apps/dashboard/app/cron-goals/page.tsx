'use client'

import { useState } from 'react'

interface CronJob {
  id: string
  name: string
  cron: string
  nextFire: string
  active: boolean
}

interface Goal {
  id: string
  title: string
  priority: number
  status: 'pending' | 'running' | 'completed' | 'failed'
}

const MOCK_JOBS: CronJob[] = [
  {
    id: 'j1',
    name: 'daily-summary',
    cron: '0 9 * * *',
    nextFire: '2026-04-22T09:00:00Z',
    active: true,
  },
  {
    id: 'j2',
    name: 'weekly-report',
    cron: '0 10 * * 1',
    nextFire: '2026-04-28T10:00:00Z',
    active: false,
  },
]

const MOCK_GOALS: Goal[] = [
  { id: 'g1', title: 'Analyze Q4 revenue data', priority: 8, status: 'pending' },
  { id: 'g2', title: 'Draft investor update email', priority: 5, status: 'running' },
]

export default function CronGoalsPage() {
  const [jobs, setJobs] = useState<CronJob[]>(MOCK_JOBS)

  function toggleJob(id: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, active: !j.active } : j)))
  }

  return (
    <main className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Cron &amp; Goals</h1>

      <section data-testid="cron-section">
        <h2 className="text-xl font-semibold mb-3">Scheduled Jobs</h2>
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="border rounded-lg p-4 flex items-center justify-between"
              data-testid={`cron-job-${job.id}`}
            >
              <div>
                <span className="font-mono font-bold">{job.name}</span>
                <span className="ml-3 text-gray-500 text-sm">{job.cron}</span>
                <span className="ml-3 text-gray-400 text-xs">Next: {job.nextFire}</span>
              </div>
              <button
                data-testid={`toggle-${job.id}`}
                onClick={() => toggleJob(job.id)}
                className={`px-3 py-1 rounded text-sm font-semibold ${job.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {job.active ? 'Active' : 'Paused'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section data-testid="goals-section">
        <h2 className="text-xl font-semibold mb-3">Goals</h2>
        <div className="space-y-2">
          {MOCK_GOALS.map((goal) => (
            <div
              key={goal.id}
              className="border rounded-lg p-4 flex items-center justify-between"
              data-testid={`goal-${goal.id}`}
            >
              <div>
                <span className="font-semibold">{goal.title}</span>
                <span className="ml-3 text-xs text-gray-500">Priority: {goal.priority}</span>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  goal.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : goal.status === 'running'
                      ? 'bg-blue-100 text-blue-700'
                      : goal.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                }`}
                data-testid={`goal-status-${goal.id}`}
              >
                {goal.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
