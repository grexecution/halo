'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Bot, X } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  date: string // ISO date YYYY-MM-DD
  time?: string // "HH:MM"
  color: 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose'
  agentHandle?: string
  description?: string
}

const COLOR_CLASSES: Record<CalendarEvent['color'], string> = {
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

const COLOR_DOT: Record<CalendarEvent['color'], string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}

const COLORS: CalendarEvent['color'][] = ['indigo', 'violet', 'emerald', 'amber', 'rose']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const STORAGE_KEY = 'greg-calendar-v1'

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function seedEvents(year: number, month: number): CalendarEvent[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`
  return [
    {
      id: 'seed-1',
      title: 'Team standup',
      date: d(2),
      time: '09:00',
      color: 'indigo',
      description: 'Daily sync with the team',
    },
    {
      id: 'seed-2',
      title: 'Deploy review',
      date: d(7),
      time: '14:00',
      color: 'violet',
      agentHandle: '@devops',
      description: 'Review staging deployment',
    },
    {
      id: 'seed-3',
      title: 'Q2 planning',
      date: d(12),
      time: '10:00',
      color: 'emerald',
      description: 'Quarterly goals planning session',
    },
    {
      id: 'seed-4',
      title: 'Client call',
      date: d(18),
      time: '16:30',
      color: 'amber',
      description: 'Demo new features to client',
    },
    {
      id: 'seed-5',
      title: 'Infra maintenance',
      date: d(24),
      time: '23:00',
      color: 'rose',
      agentHandle: '@infra',
      description: 'Scheduled downtime window',
    },
  ]
}

function getDaysInGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  // Monday-first: getDay() returns 0=Sun, 1=Mon ... we want Mon=0
  const startDow = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startDow)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  // trim last row if all other-month
  const last7 = days.slice(35)
  const allOther = last7.every((d) => d.getMonth() !== month)
  return allOther ? days.slice(0, 35) : days
}

interface AddEventModalProps {
  initialDate: string
  onClose: () => void
  onSave: (event: CalendarEvent) => void
}

function AddEventModal({ initialDate, onClose, onSave }: AddEventModalProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('')
  const [color, setColor] = useState<CalendarEvent['color']>('indigo')
  const [description, setDescription] = useState('')
  const [agentHandle, setAgentHandle] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    const timeVal = time || undefined
    const descVal = description.trim() || undefined
    const agentVal = agentHandle.trim() || undefined
    onSave({
      id: crypto.randomUUID(),
      title: title.trim(),
      date,
      ...(timeVal ? { time: timeVal } : {}),
      color,
      ...(descVal ? { description: descVal } : {}),
      ...(agentVal ? { agentHandle: agentVal } : {}),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Add Event
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-sm">Title *</label>
            <input
              className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500 transition-colors"
              placeholder="Event title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-sm">Date *</label>
              <input
                type="date"
                className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500 transition-colors"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-sm">Time</label>
              <input
                type="time"
                className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500 transition-colors"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-sm">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full ${COLOR_DOT[c]} transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-white/60 scale-110' : 'opacity-60 hover:opacity-100'}`}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-sm">Description</label>
            <textarea
              className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="Optional description..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-sm flex items-center gap-1">
              <Bot className="w-3.5 h-3.5" /> Agent handle
            </label>
            <input
              className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none focus:border-indigo-500 transition-colors"
              placeholder="@agent-handle (optional)"
              value={agentHandle}
              onChange={(e) => setAgentHandle(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mt-1 w-full py-2.5 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #6366f1, #7c3aed)' }}
          >
            + Add Event
          </button>
        </form>
      </div>
    </div>
  )
}

interface EventDetailProps {
  event: CalendarEvent
  onClose: () => void
  onDelete: (id: string) => void
}

function EventDetail({ event, onClose, onDelete }: EventDetailProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOT[event.color]}`} />
            <h2 className="text-foreground font-semibold text-base truncate">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{event.date}</span>
            {event.time && (
              <>
                <Clock className="w-4 h-4 ml-1" />
                <span>{event.time}</span>
              </>
            )}
          </div>

          {event.agentHandle && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="w-4 h-4" />
              <span className="text-indigo-400">{event.agentHandle}</span>
            </div>
          )}

          {event.description && (
            <p className="text-foreground/80 mt-1 leading-relaxed">{event.description}</p>
          )}
        </div>

        <button
          onClick={() => {
            onDelete(event.id)
            onClose()
          }}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm font-medium hover:bg-rose-500/20 transition-colors"
        >
          <X className="w-4 h-4" />
          Delete event
        </button>
      </div>
    </div>
  )
}

interface DayOverflowProps {
  date: string
  events: CalendarEvent[]
  onClose: () => void
  onEventClick: (event: CalendarEvent) => void
}

function DayOverflow({ date, events, onClose, onEventClick }: DayOverflowProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xs p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground font-semibold text-sm">{date}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => {
                onClose()
                onEventClick(ev)
              }}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium truncate ${COLOR_CLASSES[ev.color]}`}
            >
              {ev.time && <span className="mr-1 opacity-70">{ev.time}</span>}
              {ev.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [seeded, setSeeded] = useState(false)

  // modal state
  const [addModalDate, setAddModalDate] = useState<string | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)
  const [overflowDay, setOverflowDay] = useState<string | null>(null)

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CalendarEvent[]
        setEvents(parsed)
        setSeeded(true)
      }
    } catch {
      // ignore
    }
  }, [])

  // seed on first load
  useEffect(() => {
    if (!seeded) {
      const seeds = seedEvents(today.getFullYear(), today.getMonth())
      setEvents(seeds)
      setSeeded(true)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds))
      } catch {
        // ignore
      }
    }
  }, [seeded, today])

  function saveEvents(next: CalendarEvent[]) {
    setEvents(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  function addEvent(event: CalendarEvent) {
    saveEvents([...events, event])
  }

  function deleteEvent(id: string) {
    saveEvents(events.filter((e) => e.id !== id))
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const days = useMemo(() => getDaysInGrid(currentYear, currentMonth), [currentYear, currentMonth])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date]!.push(ev)
    }
    // sort by time
    for (const key of Object.keys(map)) {
      map[key]!.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    }
    return map
  }, [events])

  const todayISO = toISO(today)
  const overflowEvents = overflowDay ? (eventsByDate[overflowDay] ?? []) : []

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {MONTHS[currentMonth]} {currentYear}
            </h1>
            <p className="text-muted-foreground text-xs">Monthly view</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => {
              setCurrentYear(today.getFullYear())
              setCurrentMonth(today.getMonth())
            }}
            className="px-3 h-8 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground text-xs font-medium transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            onClick={() => setAddModalDate(todayISO)}
            className="ml-2 flex items-center gap-2 px-4 h-9 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #6366f1, #7c3aed)' }}
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className={`grid grid-cols-7 ${days.length === 35 ? 'grid-rows-5' : 'grid-rows-6'}`}>
          {days.map((day, i) => {
            const iso = toISO(day)
            const isCurrentMonth = day.getMonth() === currentMonth
            const isToday = iso === todayISO
            const dayEvents = eventsByDate[iso] ?? []
            const shown = dayEvents.slice(0, 3)
            const overflow = dayEvents.length - 3

            return (
              <div
                key={iso}
                className={[
                  'min-h-[100px] p-2 border-b border-r border-border flex flex-col gap-1 cursor-pointer group',
                  'hover:bg-muted/50 transition-colors',
                  !isCurrentMonth ? 'opacity-40' : '',
                  (i + 1) % 7 === 0 ? 'border-r-0' : '',
                  i >= days.length - 7 ? 'border-b-0' : '',
                ].join(' ')}
                onClick={() => setAddModalDate(iso)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between">
                  <span
                    className={[
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors',
                      isToday
                        ? 'bg-indigo-500 text-white ring-2 ring-indigo-500/30'
                        : 'text-foreground group-hover:bg-muted',
                    ].join(' ')}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Events */}
                <div className="flex flex-col gap-0.5">
                  {shown.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailEvent(ev)
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded border text-xs font-medium truncate leading-5 ${COLOR_CLASSES[ev.color]}`}
                    >
                      {ev.time && <span className="mr-0.5 opacity-70 text-[10px]">{ev.time}</span>}
                      {ev.title}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOverflowDay(iso)
                      }}
                      className="text-left px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {addModalDate && (
        <AddEventModal
          initialDate={addModalDate}
          onClose={() => setAddModalDate(null)}
          onSave={addEvent}
        />
      )}

      {detailEvent && (
        <EventDetail
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onDelete={deleteEvent}
        />
      )}

      {overflowDay && (
        <DayOverflow
          date={overflowDay}
          events={overflowEvents}
          onClose={() => setOverflowDay(null)}
          onEventClick={(ev) => setDetailEvent(ev)}
        />
      )}
    </div>
  )
}
