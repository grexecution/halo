'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  MessageSquare,
  Bot,
  Target,
  Brain,
  Briefcase,
  Plug,
  ScrollText,
  Settings,
  FileText,
  Circle,
  ClipboardCheck,
  Play,
  BookOpen,
} from 'lucide-react'
import { cn } from './ui/cn'

const CORE_NAV = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/cron-goals', label: 'Goals & Cron', icon: Target },
  { href: '/runs', label: 'Runs', icon: Play },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck, badge: true },
  { href: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/workspaces', label: 'Workspaces', icon: Briefcase },
  { href: '/connectors', label: 'Connectors', icon: Plug },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface CustomPage {
  href: string
  label: string
}

export function Sidebar() {
  const pathname = usePathname()
  const [customPages, setCustomPages] = useState<CustomPage[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [runningAgents, setRunningAgents] = useState(0)

  useEffect(() => {
    fetch('/api/custom-pages')
      .then((r) => r.json())
      .then((data: { pages: CustomPage[] }) => setCustomPages(data.pages ?? []))
      .catch(() => undefined)
  }, [])

  // Poll for pending approvals + running agents every 5 s
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
    <nav className="flex flex-col w-52 min-h-screen bg-gray-950 border-r border-gray-800/60 flex-shrink-0">
      <div className="px-4 py-4 border-b border-gray-800/60">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Circle size={10} className="text-white fill-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">open-greg</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {CORE_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            const badgeCount = item.href === '/approvals' ? pendingApprovals : 0
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    active
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/50',
                  )}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}

          {customPages.length > 0 && (
            <>
              <li className="pt-3 pb-1 px-3">
                <span className="text-[10px] text-gray-700 uppercase tracking-widest font-semibold">
                  Custom
                </span>
              </li>
              {customPages.map((page) => {
                const active = pathname === page.href
                return (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/50',
                      )}
                    >
                      <FileText size={15} className="flex-shrink-0" />
                      {page.label}
                    </Link>
                  </li>
                )
              })}
            </>
          )}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-gray-800/60 space-y-2">
        {runningAgents > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <span className="text-xs text-gray-500">
              {runningAgents} agent{runningAgents !== 1 ? 's' : ''} running
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="text-xs text-gray-600">local instance</span>
        </div>
      </div>
    </nav>
  )
}
