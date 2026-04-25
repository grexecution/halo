'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  CheckSquare,
  Clock,
  CheckCircle2,
  Trash2,
  GripVertical,
  Bot,
  Zap,
} from 'lucide-react'
import { Button, Input, Dialog, EmptyState } from '../components/ui/index'
import { cn } from '../components/ui/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'todo' | 'in_progress' | 'done'

interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: 'low' | 'medium' | 'high'
  agentHandle?: string
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: {
  id: TaskStatus
  label: string
  icon: React.ReactNode
  colorClass: string
  badgeClass: string
  countClass: string
}[] = [
  {
    id: 'todo',
    label: 'Todo',
    icon: <CheckSquare size={15} />,
    colorClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border border-border',
    countClass: 'bg-muted text-muted-foreground',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    icon: <Clock size={15} />,
    colorClass: 'text-blue-500',
    badgeClass: 'bg-blue-500/15 text-blue-500 border border-blue-500/25',
    countClass: 'bg-blue-500/15 text-blue-500',
  },
  {
    id: 'done',
    label: 'Done',
    icon: <CheckCircle2 size={15} />,
    colorClass: 'text-green-500',
    badgeClass: 'bg-green-500/15 text-green-500 border border-green-500/25',
    countClass: 'bg-green-500/15 text-green-500',
  },
]

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
}

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/15 text-amber-500',
  high: 'bg-red-500/15 text-red-500',
}

const STORAGE_KEY = 'greg-tasks-v1'

const SAMPLE_TASKS: Task[] = [
  {
    id: 'sample-1',
    title: 'Review weekly agent runs',
    description: 'Check all scheduled automation runs for the past week and look for failures.',
    status: 'todo',
    priority: 'medium',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    title: 'Update connector credentials',
    description: 'Rotate API keys for GitHub and Slack connectors before expiry.',
    status: 'in_progress',
    priority: 'high',
    agentHandle: 'main',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    title: 'Summarize Q2 goals',
    description: 'Use the agent to compile a progress report on all Q2 goals.',
    status: 'done',
    priority: 'low',
    agentHandle: 'main',
    createdAt: new Date().toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function loadTasks(): Task[] {
  if (typeof window === 'undefined') return SAMPLE_TASKS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return SAMPLE_TASKS
    const parsed = JSON.parse(raw) as Task[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SAMPLE_TASKS
  } catch {
    return SAMPLE_TASKS
  }
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // storage unavailable — no-op
  }
}

// ─── New Task Form ────────────────────────────────────────────────────────────

interface NewTaskForm {
  title: string
  description: string
  priority: Task['priority']
  status: TaskStatus
  agentHandle: string
}

const BLANK_FORM: NewTaskForm = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  agentHandle: '',
}

interface NewTaskDialogProps {
  open: boolean
  onClose: () => void
  onSave: (task: Task) => void
}

function NewTaskDialog({ open, onClose, onSave }: NewTaskDialogProps) {
  const [form, setForm] = useState<NewTaskForm>(BLANK_FORM)

  useEffect(() => {
    if (open) setForm(BLANK_FORM)
  }, [open])

  function handleSave() {
    if (!form.title.trim()) return
    const descVal = form.description.trim()
    const agentVal = form.agentHandle.trim()
    const task: Task = {
      id: newId(),
      title: form.title.trim(),
      ...(descVal ? { description: descVal } : {}),
      status: form.status,
      priority: form.priority,
      ...(agentVal ? { agentHandle: agentVal } : {}),
      createdAt: new Date().toISOString(),
    }
    onSave(task)
    onClose()
  }

  const canSave = form.title.trim().length > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Task"
      description="Add a task to your kanban board."
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="What needs to be done?"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && canSave && handleSave()}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </label>
          <textarea
            className={cn(
              'w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground resize-none',
              'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
            )}
            rows={3}
            placeholder="Optional details…"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* Priority + Status row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Priority
            </label>
            <select
              className={cn(
                'w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground',
                'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
              )}
              value={form.priority}
              onChange={(e) =>
                setForm((p) => ({ ...p, priority: e.target.value as Task['priority'] }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Initial Status
            </label>
            <select
              className={cn(
                'w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground',
                'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30',
              )}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TaskStatus }))}
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        {/* Agent handle */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Assign to Agent{' '}
            <span className="text-muted-foreground font-normal normal-case">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
              @
            </span>
            <Input
              className="pl-6"
              value={form.agentHandle}
              onChange={(e) =>
                setForm((p) => ({ ...p, agentHandle: e.target.value.replace(/^@/, '') }))
              }
              placeholder="agent-handle"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
          >
            <Plus size={13} />
            Create Task
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  onDelete: (id: string) => void
  onAdvance: (id: string) => void
}

function TaskCard({ task, onDelete, onAdvance }: TaskCardProps) {
  const [hovered, setHovered] = useState(false)
  const next = NEXT_STATUS[task.status]

  return (
    <div
      className={cn(
        'group relative bg-card border border-border rounded-xl p-4 space-y-3',
        'transition-all duration-150',
        hovered && 'border-border/80 shadow-lg shadow-black/20',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle + delete */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical size={14} className="text-muted-foreground" />
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-foreground leading-snug pr-6 pl-4 group-hover:pl-0 transition-all">
        {task.title}
      </p>

      {/* Description snippet */}
      {task.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer row: priority, agent, advance button */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize',
              PRIORITY_STYLES[task.priority],
            )}
          >
            {task.priority === 'high' && <Zap size={10} className="mr-1" />}
            {task.priority}
          </span>

          {/* Agent chip */}
          {task.agentHandle && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[11px] text-muted-foreground">
              <Bot size={10} />@{task.agentHandle}
            </span>
          )}
        </div>

        {/* Move forward button */}
        {next !== null && (
          <button
            onClick={() => onAdvance(task.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
              'bg-muted text-muted-foreground hover:bg-indigo-500/15 hover:text-indigo-400 border border-transparent hover:border-indigo-500/30',
            )}
          >
            Move →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: (typeof COLUMNS)[number]
  tasks: Task[]
  onDelete: (id: string) => void
  onAdvance: (id: string) => void
  onAddNew: () => void
}

function KanbanColumn({ column, tasks, onDelete, onAdvance, onAddNew }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn('flex items-center gap-1.5 text-sm font-semibold', column.colorClass)}
          >
            {column.icon}
            {column.label}
          </span>
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold',
              column.countClass,
            )}
          >
            {tasks.length}
          </span>
        </div>
        {column.id === 'todo' && (
          <button
            onClick={onAddNew}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Add task"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className={cn('h-0.5 rounded-full mb-4', column.badgeClass.split(' ')[0])} />

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-muted-foreground/40 mb-2">
              {column.id === 'todo' ? (
                <CheckSquare size={24} />
              ) : column.id === 'in_progress' ? (
                <Clock size={24} />
              ) : (
                <CheckCircle2 size={24} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} onAdvance={onAdvance} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setTasks(loadTasks())
    setLoaded(true)
  }, [])

  // Persist on every change (after initial load)
  useEffect(() => {
    if (loaded) saveTasks(tasks)
  }, [tasks, loaded])

  // Also try syncing with API (fire-and-forget, graceful degradation)
  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const remote = (data as { tasks?: Task[] }).tasks
        if (Array.isArray(remote) && remote.length > 0) {
          setTasks(remote)
        }
      })
      .catch(() => {
        // API not available — use localStorage only
      })
  }, [])

  function handleAdd(task: Task) {
    setTasks((prev) => [task, ...prev])
    // Fire-and-forget API sync
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }).catch(() => {})
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function handleAdvance(id: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next = NEXT_STATUS[t.status]
        if (!next) return t
        const updated = { ...t, status: next }
        // Fire-and-forget API sync
        fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        }).catch(() => {})
        return updated
      }),
    )
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  const totalTasks = tasks.length
  const doneTasks = tasksByStatus('done').length
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <main className="flex flex-col h-full p-6 gap-6 min-h-screen bg-background">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalTasks === 0
                ? 'No tasks yet'
                : `${doneTasks} of ${totalTasks} done · ${progressPct}% complete`}
            </p>
          </div>

          {/* Progress bar */}
          {totalTasks > 0 && (
            <div className="hidden sm:flex flex-col justify-center w-32">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 shadow-lg shadow-indigo-900/20"
        >
          <Plus size={15} />
          New Task
        </Button>
      </div>

      {/* Kanban board */}
      {!loaded ? (
        // Loading skeleton
        <div className="grid grid-cols-3 gap-4 flex-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-20 mb-4" />
              <div className="space-y-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-20 bg-muted rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        // Empty state
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CheckSquare size={40} />}
            title="No tasks yet"
            description="Create your first task to get started with the kanban board."
            action={
              <Button
                onClick={() => setDialogOpen(true)}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
              >
                <Plus size={14} />
                New Task
              </Button>
            }
          />
        </div>
      ) : (
        // Three-column kanban
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className="bg-card/50 border border-border rounded-xl p-4 flex flex-col min-h-0 max-h-[calc(100vh-12rem)]"
            >
              <KanbanColumn
                column={col}
                tasks={tasksByStatus(col.id)}
                onDelete={handleDelete}
                onAdvance={handleAdvance}
                onAddNew={() => setDialogOpen(true)}
              />
            </div>
          ))}
        </div>
      )}

      {/* New Task dialog */}
      <NewTaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSave={handleAdd} />
    </main>
  )
}
