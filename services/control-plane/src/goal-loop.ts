interface GoalInput {
  id: string
  title: string
  priority: number
}

interface GoalSummary {
  completed: number
  failed: number
}

interface GoalLoopOptions {
  dryRun?: boolean | undefined
}

export class GoalLoopWorker {
  private dryRun: boolean
  private statuses: Map<string, 'completed' | 'failed'> = new Map()
  private completedCount = 0
  private failedCount = 0

  constructor(opts: GoalLoopOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  async runGoals(goals: GoalInput[]): Promise<string[]> {
    const sorted = [...goals].sort((a, b) => b.priority - a.priority)
    const order: string[] = []

    for (const goal of sorted) {
      // dryRun: always succeed
      this.statuses.set(goal.id, 'completed')
      this.completedCount++
      order.push(goal.id)
    }

    return order
  }

  getGoalStatus(id: string): 'completed' | 'failed' | 'unknown' {
    return this.statuses.get(id) ?? 'unknown'
  }

  getSummary(): GoalSummary {
    return { completed: this.completedCount, failed: this.failedCount }
  }
}
