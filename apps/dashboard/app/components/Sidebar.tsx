'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const CORE_NAV = [
  { href: '/hub', label: 'Hub', icon: '⬡' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/agents', label: 'Agents', icon: '🤖' },
  { href: '/cron-goals', label: 'Goals & Cron', icon: '🎯' },
  { href: '/memory', label: 'Memory', icon: '🧠' },
  { href: '/connectors', label: 'Connectors', icon: '🔌' },
  { href: '/registry', label: 'Registry', icon: '📦' },
  { href: '/logs', label: 'Logs', icon: '📋' },
  { href: '/build-health', label: 'Build Health', icon: '🏗️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

interface CustomPage {
  href: string
  label: string
  icon?: string
}

export function Sidebar() {
  const pathname = usePathname()
  const [customPages, setCustomPages] = useState<CustomPage[]>([])

  useEffect(() => {
    fetch('/api/custom-pages')
      .then((r) => r.json())
      .then((data: { pages: CustomPage[] }) => setCustomPages(data.pages ?? []))
      .catch(() => {
        /* custom pages are optional */
      })
  }, [])

  return (
    <nav className="flex flex-col w-56 min-h-screen bg-gray-950 text-gray-100 border-r border-gray-800">
      <div className="px-4 py-5 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">claw-alt</span>
          <span className="text-xs text-gray-500 font-mono">v0.1</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {CORE_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-gray-800 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}

          {customPages.length > 0 && (
            <>
              <li className="pt-3 pb-1">
                <span className="px-3 text-xs text-gray-600 uppercase tracking-wider font-semibold">
                  Custom
                </span>
              </li>
              {customPages.map((page) => {
                const active = pathname === page.href
                return (
                  <li key={page.href}>
                    <Link
                      href={page.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-gray-800 text-white font-medium'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                      }`}
                    >
                      <span className="text-base leading-none">{page.icon ?? '📄'}</span>
                      {page.label}
                    </Link>
                  </li>
                )
              })}
            </>
          )}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-500">Local instance</span>
        </div>
      </div>
    </nav>
  )
}
