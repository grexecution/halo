'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Target, Clock } from 'lucide-react'
import {
  cn,
  Button,
  Badge,
  Input,
  Textarea,
  Label,
  Select,
  Switch,
  Dialog,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
  StatusDot,
} from '../components/ui/index'
import { TableSkeleton } from '../components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalStatus = 'pending' | 'running' | 'completed' | 'failed'
type GoalPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

interface Goal {
  id: string
  title: string
  description?: string
  priority: GoalPriority
  status: GoalStatus
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

interface CronJob {
  id: string
  name: string
  schedule: string
  goal?: string
  command?: string
  active: boolean
  createdAt: string
  lastRunAt?: string
  lastRunStatus?: 'success' | 'failure'
  nextRunAt?: string
  runCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityColor(p: number): string {
  if (p <= 3) return 'bg-red-900/40 text-red-400 border border-red-800'
  if (p <= 6) return 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
  return 'bg-green-900/40 text-green-400 border border-green-800'
}

function goalStatusVariant(status: GoalStatus): 'warning' | 'info' | 'success' | 'danger' {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'running':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
  }
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Goal Dialog ──────────────────────────────────────────────────────────────

interface GoalFormData {
  title: string
  description: string
  priority: string
}

interface GoalDialogProps {
  open: boolean
  initial: GoalFormData | null
  onClose: () => void
  onSave: (data: GoalFormData) => void
}

function GoalDialog({ open, initial, onClose, onSave }: GoalDialogProps) {
  const [form, setForm] = useState<GoalFormData>({ title: '', description: '', priority: '5' })

  useEffect(() => {
    if (open) {
      setForm(initial ?? { title: '', description: '', priority: '5' })
    }
  }, [open, initial])

  function handleSave() {
    if (!form.title.trim()) return
    onSave(form)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Goal' : 'Add Goal'}
      description="Goals represent tasks for your agents to accomplish."
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="goal-title">Title</Label>
          <Input
            id="goal-title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Goal title"
          />
        </div>
        <div>
          <Label htmlFor="goal-desc">Description</Label>
          <Textarea
            id="goal-desc"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional description"
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="goal-priority">Priority</Label>
          <Select
            id="goal-priority"
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.title.trim()}>
            {initial ? 'Save Changes' : 'Add Goal'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Cron Dialog ──────────────────────────────────────────────────────────────

interface CronFormData {
  name: string
  schedule: string
  goal: string
  command: string
}

interface CronDialogProps {
  open: boolean
  initial: CronFormData | null
  onClose: () => void
  onSave: (data: CronFormData) => void
}

function CronDialog({ open, initial, onClose, onSave }: CronDialogProps) {
  const [form, setForm] = useState<CronFormData>({ name: '', schedule: '', goal: '', command: '' })

  useEffect(() => {
    if (open) {
      setForm(initial ?? { name: '', schedule: '', goal: '', command: '' })
    }
  }, [open, initial])

  function handleSave() {
    if (!form.name.trim() || !form.schedule.trim()) return
    onSave(form)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Cron Job' : 'Add Cron Job'}
      description="Schedule automated tasks to run on a recurring basis."
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="cron-name">Name</Label>
          <Input
            id="cron-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="job-name"
            className="font-mono"
          />
        </div>
        <div>
          <Label htmlFor="cron-schedule">Schedule</Label>
          <Input
            id="cron-schedule"
            value={form.schedule}
            onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))}
            placeholder="0 9 * * *"
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground/70 mt-1.5">
            Examples: <span className="font-mono text-muted-foreground">0 9 * * *</span> (daily 9am)
            &middot; <span className="font-mono text-muted-foreground">0 10 * * 1</span> (weekly
            Mon)
          </p>
        </div>
        <div>
          <Label htmlFor="cron-goal">Goal (optional)</Label>
          <Input
            id="cron-goal"
            value={form.goal}
            onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
            placeholder="goal to trigger"
          />
        </div>
        <div>
          <Label htmlFor="cron-command">Command (optional)</Label>
          <Textarea
            id="cron-command"
            value={form.command}
            onChange={(e) => setForm((p) => ({ ...p, command: e.target.value }))}
            placeholder="shell command to run"
            rows={3}
            className="font-mono"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || !form.schedule.trim()}>
            {initial ? 'Save Changes' : 'New Schedule'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals')
      if (res.ok) {
        const data = (await res.json()) as { goals: Goal[] }
        setGoals(data.goals)
      }
    } catch {
      // ignore fetch errors on initial load
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchGoals()
  }, [fetchGoals])

  function openAdd() {
    setEditingGoal(null)
    setDialogOpen(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    setDialogOpen(true)
  }

  async function handleSave(data: GoalFormData) {
    const priority = Number(data.priority) as GoalPriority
    const description = data.description || undefined

    if (editingGoal) {
      const merged: Goal = {
        ...editingGoal,
        title: data.title,
        priority,
        updatedAt: new Date().toISOString(),
        ...(description !== undefined ? { description } : {}),
      }
      const optimistic = goals.map((g) => (g.id === editingGoal.id ? merged : g))
      setGoals(optimistic)
      setDialogOpen(false)
      try {
        const patchBody: { title: string; priority: number; description?: string } = {
          title: data.title,
          priority,
        }
        if (description !== undefined) patchBody.description = description
        const res = await fetch(`/api/goals/${editingGoal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        })
        if (!res.ok) setGoals(goals) // revert
      } catch {
        setGoals(goals)
      }
    } else {
      setDialogOpen(false)
      try {
        const postBody: { title: string; priority: number; description?: string } = {
          title: data.title,
          priority,
        }
        if (description !== undefined) postBody.description = description
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody),
        })
        if (res.ok) {
          const created = (await res.json()) as Goal
          setGoals((prev) => [...prev, created])
        }
      } catch {
        // ignore
      }
    }
  }

  async function handleDelete(goal: Goal) {
    if (!window.confirm(`Delete goal "${goal.title}"?`)) return
    const prev = goals
    setGoals(goals.filter((g) => g.id !== goal.id))
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' })
      if (!res.ok) setGoals(prev)
    } catch {
      setGoals(prev)
    }
  }

  const total = goals.length
  const pending = goals.filter((g) => g.status === 'pending').length
  const running = goals.filter((g) => g.status === 'running').length
  const completed = goals.filter((g) => g.status === 'completed').length

  const editFormData: GoalFormData | null = editingGoal
    ? {
        title: editingGoal.title,
        description: editingGoal.description ?? '',
        priority: String(editingGoal.priority),
      }
    : null

  return (
    <div data-testid="goals-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Goals</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} />
          Add Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{total} total</span>
        {pending > 0 && <Badge variant="warning">{pending} pending</Badge>}
        {running > 0 && <Badge variant="info">{running} running</Badge>}
        {completed > 0 && <Badge variant="success">{completed} completed</Badge>}
      </div>

      {/* List */}
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={<Target size={36} />}
          title="No goals yet"
          description="Add a goal to get started"
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} />
              Add Goal
            </Button>
          }
        />
      ) : (
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[40px_1fr_120px_160px_80px] gap-3 px-3 py-1.5 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            <span>Pri</span>
            <span>Title</span>
            <span>Status</span>
            <span>Last Run</span>
            <span className="text-right">Actions</span>
          </div>
          {goals.map((goal) => (
            <div
              key={goal.id}
              data-testid={`goal-${goal.id}`}
              className="grid grid-cols-[40px_1fr_120px_160px_80px] gap-3 items-center px-3 py-2.5 bg-card border border-border rounded-lg hover:border-border transition-colors"
            >
              {/* Priority badge */}
              <span
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded text-[11px] font-bold font-mono',
                  priorityColor(goal.priority),
                )}
              >
                {goal.priority}
              </span>

              {/* Title */}
              <span className="text-sm text-foreground font-medium truncate">{goal.title}</span>

              {/* Status */}
              <Badge
                variant={goalStatusVariant(goal.status)}
                data-testid={`goal-status-${goal.id}`}
              >
                {goal.status}
              </Badge>

              {/* Last run */}
              <span className="text-xs text-muted-foreground">
                {goal.lastRunAt ? (
                  fmtDate(goal.lastRunAt)
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(goal)}
                  title="Edit goal"
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(goal)}
                  title="Delete goal"
                  className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <GoalDialog
        open={dialogOpen}
        initial={editFormData}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}

// ─── Cron Jobs Tab ────────────────────────────────────────────────────────────

function CronJobsTab() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<CronJob | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/crons')
      if (res.ok) {
        const data = (await res.json()) as { jobs: CronJob[] }
        setJobs(data.jobs)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchJobs()
  }, [fetchJobs])

  function openAdd() {
    setEditingJob(null)
    setDialogOpen(true)
  }

  function openEdit(job: CronJob) {
    setEditingJob(job)
    setDialogOpen(true)
  }

  async function handleToggle(job: CronJob) {
    const updated = { ...job, active: !job.active }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)))
    try {
      const res = await fetch(`/api/crons/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !job.active }),
      })
      if (!res.ok) setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))
    }
  }

  async function handleSave(data: CronFormData) {
    const goal = data.goal || undefined
    const command = data.command || undefined

    if (editingJob) {
      const prev = jobs
      const merged: CronJob = {
        ...editingJob,
        name: data.name,
        schedule: data.schedule,
        ...(goal !== undefined ? { goal } : {}),
        ...(command !== undefined ? { command } : {}),
      }
      setJobs((js) => js.map((j) => (j.id === editingJob.id ? merged : j)))
      setDialogOpen(false)
      try {
        const patchBody: { name: string; schedule: string; goal?: string; command?: string } = {
          name: data.name,
          schedule: data.schedule,
        }
        if (goal !== undefined) patchBody.goal = goal
        if (command !== undefined) patchBody.command = command
        const res = await fetch(`/api/crons/${editingJob.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        })
        if (!res.ok) setJobs(prev)
      } catch {
        setJobs(prev)
      }
    } else {
      setDialogOpen(false)
      try {
        const postBody: { name: string; schedule: string; goal?: string; command?: string } = {
          name: data.name,
          schedule: data.schedule,
        }
        if (goal !== undefined) postBody.goal = goal
        if (command !== undefined) postBody.command = command
        const res = await fetch('/api/crons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody),
        })
        if (res.ok) {
          const created = (await res.json()) as CronJob
          setJobs((prev) => [...prev, created])
        }
      } catch {
        // ignore
      }
    }
  }

  async function handleDelete(job: CronJob) {
    if (!window.confirm(`Delete schedule "${job.name}"?`)) return
    const prev = jobs
    setJobs(jobs.filter((j) => j.id !== job.id))
    try {
      const res = await fetch(`/api/crons/${job.id}`, { method: 'DELETE' })
      if (!res.ok) setJobs(prev)
    } catch {
      setJobs(prev)
    }
  }

  const total = jobs.length
  const active = jobs.filter((j) => j.active).length
  const paused = jobs.filter((j) => !j.active).length

  const editFormData: CronFormData | null = editingJob
    ? {
        name: editingJob.name,
        schedule: editingJob.schedule,
        goal: editingJob.goal ?? '',
        command: editingJob.command ?? '',
      }
    : null

  return (
    <div data-testid="cron-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Schedules</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} />
          New Schedule
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{total} total</span>
        {active > 0 && <Badge variant="success">{active} active</Badge>}
        {paused > 0 && <Badge variant="muted">{paused} paused</Badge>}
      </div>

      {/* List */}
      {loading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Clock size={36} />}
          title="No schedules yet"
          description="Set Halo to run automatically — daily summaries, weekly reports, and more"
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} />
              New Schedule
            </Button>
          }
        />
      ) : (
        <div className="space-y-1">
          {jobs.map((job) => (
            <div
              key={job.id}
              data-testid={`cron-job-${job.id}`}
              className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg hover:border-border transition-colors"
            >
              {/* Active toggle */}
              <Switch
                checked={job.active}
                onChange={() => handleToggle(job)}
                id={`toggle-${job.id}`}
                data-testid={`toggle-${job.id}`}
              />

              {/* Name + schedule */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-medium text-foreground">{job.name}</span>
                  <span className="text-xs font-mono text-muted-foreground">{job.schedule}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {job.nextRunAt && (
                    <span className="text-[11px] text-muted-foreground/70">
                      Next: {fmtDate(job.nextRunAt)}
                    </span>
                  )}
                  {job.goal && (
                    <span className="text-[11px] text-muted-foreground/70">
                      Goal: <span className="text-muted-foreground">{job.goal}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Last run */}
              {job.lastRunAt && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 shrink-0">
                  <StatusDot
                    status={
                      job.lastRunStatus === 'success'
                        ? 'online'
                        : job.lastRunStatus === 'failure'
                          ? 'error'
                          : 'offline'
                    }
                  />
                  {fmtDate(job.lastRunAt)}
                </div>
              )}

              {/* Run count */}
              <span className="text-[11px] text-muted-foreground/70 shrink-0 w-16 text-right">
                {job.runCount} runs
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(job)} title="Edit job">
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(job)}
                  title="Delete job"
                  className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CronDialog
        open={dialogOpen}
        initial={editFormData}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CronGoalsPage() {
  return (
    <main className="p-6 max-w-5xl mx-auto">
      <Tabs defaultValue="goals">
        <TabsList>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="crons">Schedules</TabsTrigger>
        </TabsList>
        <TabsContent value="goals">
          <GoalsTab />
        </TabsContent>
        <TabsContent value="crons">
          <CronJobsTab />
        </TabsContent>
      </Tabs>
    </main>
  )
}
