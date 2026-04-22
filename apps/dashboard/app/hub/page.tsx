'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, Cpu, Plus, Target } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  Input,
  Label,
  StatusDot,
  cn,
} from '../components/ui/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Instance {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'unknown'
  lastSeen?: string
  version?: string
  agentCount?: number
  activeGoals?: number
  llmModel?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLocal(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1')
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-800 animate-pulse" />
          <div className="h-4 w-32 rounded bg-gray-800 animate-pulse" />
          <div className="h-4 w-12 rounded bg-gray-800 animate-pulse" />
        </div>
        <div className="h-3 w-48 rounded bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="h-8 rounded-lg bg-gray-800 animate-pulse" />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Instance card
// ---------------------------------------------------------------------------

function StatBlock({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-800/60 rounded-lg py-2 px-1 gap-1">
      <div className="flex items-center gap-1 text-gray-400">{icon}</div>
      <span className="text-xs font-semibold text-white truncate max-w-full px-1">{value}</span>
      <span className="text-[10px] text-gray-600">{label}</span>
    </div>
  )
}

function InstanceCard({ instance }: { instance: Instance }) {
  const local = isLocal(instance.url)

  const statusForDot =
    instance.status === 'online'
      ? ('online' as const)
      : instance.status === 'offline'
        ? ('offline' as const)
        : ('pending' as const)

  return (
    <Card
      data-testid={`instance-card-${instance.id}`}
      className="flex flex-col hover:border-gray-700 transition-colors"
    >
      <CardContent className="flex flex-col gap-4 py-5 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusDot
                status={statusForDot}
                pulse={instance.status === 'online'}
                data-testid={`instance-status-${instance.id}`}
              />
              <span className="font-semibold text-white text-sm">{instance.name}</span>
              <Badge variant={local ? 'info' : 'default'}>{local ? 'local' : 'remote'}</Badge>
            </div>
            <p className="font-mono text-xs text-gray-500 mt-1 truncate">{instance.url}</p>
          </div>
          {instance.version && (
            <Badge variant="muted" className="flex-shrink-0">
              v{instance.version}
            </Badge>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatBlock icon={<Bot size={12} />} value={instance.agentCount ?? '—'} label="agents" />
          <StatBlock
            icon={<Target size={12} />}
            value={instance.activeGoals ?? '—'}
            label="goals"
          />
          <StatBlock icon={<Cpu size={12} />} value={instance.llmModel ?? '—'} label="model" />
        </div>

        {/* Last seen */}
        {instance.lastSeen && (
          <p className="text-xs text-gray-600">Last seen {relativeTime(instance.lastSeen)}</p>
        )}

        {/* Action */}
        <div className="mt-auto">
          {instance.status === 'offline' ? (
            <Badge variant="muted" className="w-full justify-center py-1.5 text-xs">
              Offline
            </Badge>
          ) : local ? (
            <Link href="/chat" className="block">
              <Button className="w-full" size="sm">
                Open Chat
              </Button>
            </Link>
          ) : (
            <a href={instance.url} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full" size="sm">
                View
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Add Instance card + dialog
// ---------------------------------------------------------------------------

function AddInstanceCard({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!url.trim()) return
    setLoading(true)
    try {
      await fetch('/api/hub/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
      })
      onAdded()
    } catch {
      // silently ignore — will refresh anyway
    } finally {
      setLoading(false)
      setOpen(false)
      setUrl('')
      setName('')
    }
  }

  return (
    <>
      <button
        data-testid="add-instance-button"
        onClick={() => setOpen(true)}
        className={cn(
          'border-2 border-dashed border-gray-800 hover:border-gray-600',
          'rounded-xl flex flex-col items-center justify-center gap-2',
          'min-h-[180px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer w-full',
        )}
      >
        <Plus size={20} />
        <span className="text-sm">Add instance</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add Remote Instance"
        description="Connect to another open-greg instance by URL."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="instance-url">URL</Label>
            <Input
              id="instance-url"
              data-testid="instance-url-input"
              type="url"
              placeholder="https://your-server.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instance-name">Name (optional)</Label>
            <Input
              id="instance-name"
              placeholder="Production"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              data-testid="register-instance-button"
              onClick={handleRegister}
              disabled={loading || !url.trim()}
              className="flex-1"
            >
              {loading ? 'Registering...' : 'Register'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HubPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function fetchInstances() {
    fetch('/api/hub/instances')
      .then((r) => r.json())
      .then((data: { instances: Instance[] }) => {
        setInstances(data.instances ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchInstances()
    intervalRef.current = setInterval(fetchInstances, 30000)
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your open-greg instances</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          instances.map((inst) => <InstanceCard key={inst.id} instance={inst} />)
        )}

        <AddInstanceCard onAdded={fetchInstances} />
      </div>
    </main>
  )
}
