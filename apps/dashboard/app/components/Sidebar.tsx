'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  MessageSquare,
  Bot,
  Brain,
  Zap,
  ShieldCheck,
  Activity,
  Plug2,
  BookOpen,
  Layers,
  Terminal,
  BarChart3,
  SlidersHorizontal,
  CheckSquare,
  CalendarDays,
  FileText,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react'
import { cn } from './ui/cn'

const WORKSPACE_NAV = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/memory', label: 'Memory', icon: Brain },
]

const AUTOMATE_NAV = [
  { href: '/cron-goals', label: 'Automations', icon: Zap },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: true },
  { href: '/runs', label: 'Runs', icon: Activity },
]

const CONNECT_NAV = [
  { href: '/connectors', label: 'Connectors', icon: Plug2 },
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { href: '/workspaces', label: 'Workspaces', icon: Layers },
]

const SYSTEM_NAV = [
  { href: '/logs', label: 'Logs', icon: Terminal },
  { href: '/cost', label: 'Cost', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: SlidersHorizontal },
]

interface CustomPage {
  href: string
  label: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: boolean
}

interface NavSectionProps {
  label: string
  items: NavItem[]
  pathname: string
  pendingApprovals: number
}

function NavSection({ label, items, pathname, pendingApprovals }: NavSectionProps) {
  return (
    <div className="mb-1">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/50 select-none">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const badgeCount = item.badge ? pendingApprovals : 0
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                  active
                    ? 'bg-sidebar-item-active text-sidebar-text-active font-medium'
                    : 'text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-item-hover',
                )}
              >
                <Icon
                  size={14}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    active
                      ? 'text-primary'
                      : 'text-sidebar-text group-hover:text-sidebar-text-active',
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums">
                    {badgeCount}
                  </span>
                )}
                {active && <span className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [customPages, setCustomPages] = useState<CustomPage[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [runningAgents, setRunningAgents] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    fetch('/api/custom-pages')
      .then((r) => r.json())
      .then((data: { pages: CustomPage[] }) => setCustomPages(data.pages ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    function poll() {
      fetch('/api/approvals?status=pending')
        .then((r) => r.json())
        .then((d: { approvals?: unknown[] }) => setPendingApprovals(d.approvals?.length ?? 0))
        .catch(() => undefined)

      fetch('/api/runs?limit=20')
        .then((r) => r.json())
        .then((d: { runs?: Array<{ status: string }> }) =>
          setRunningAgents((d.runs ?? []).filter((r) => r.status === 'running').length),
        )
        .catch(() => undefined)
    }
    poll()
    const t = setInterval(poll, 5_000)
    return () => clearInterval(t)
  }, [])

  return (
    <nav className="flex flex-col w-52 min-h-screen bg-sidebar-bg border-r border-sidebar-border flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-sidebar-text-active tracking-tight">
            Halo
          </span>
        </Link>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
        <NavSection
          label="Workspace"
          items={WORKSPACE_NAV}
          pathname={pathname}
          pendingApprovals={pendingApprovals}
        />
        <NavSection
          label="Automate"
          items={AUTOMATE_NAV}
          pathname={pathname}
          pendingApprovals={pendingApprovals}
        />
        <NavSection
          label="Connect"
          items={CONNECT_NAV}
          pathname={pathname}
          pendingApprovals={pendingApprovals}
        />
        <NavSection
          label="System"
          items={SYSTEM_NAV}
          pathname={pathname}
          pendingApprovals={pendingApprovals}
        />

        {customPages.length > 0 && (
          <div className="mb-1">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/50 select-none">
              Custom
            </p>
            <ul className="space-y-0.5">
              {customPages.map((page) => {
                const active = pathname === page.href
                return (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                        active
                          ? 'bg-sidebar-item-active text-sidebar-text-active font-medium'
                          : 'text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-item-hover',
                      )}
                    >
                      <FileText size={14} className="flex-shrink-0 text-sidebar-text" />
                      {page.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        {runningAgents > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full status-dot-running flex-shrink-0" />
            <span className="text-xs text-sidebar-text">
              {runningAgents} agent{runningAgents !== 1 ? 's' : ''} running
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full status-dot-online flex-shrink-0" />
            <span className="text-xs text-sidebar-text">online</span>
          </div>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-md text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-item-hover transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
