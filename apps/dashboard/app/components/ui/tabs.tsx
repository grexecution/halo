'use client'
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from './cn'

const TabsCtx = createContext<{ active: string; setActive: (v: string) => void }>({
  active: '',
  setActive: () => undefined,
})

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string
  children: ReactNode
  className?: string
}) {
  const [active, setActive] = useState(defaultValue)
  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex gap-1 border-b border-gray-800 mb-4', className)}>{children}</div>
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { active, setActive } = useContext(TabsCtx)
  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
        active === value
          ? 'text-white border-blue-500'
          : 'text-gray-500 border-transparent hover:text-gray-300',
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  const { active } = useContext(TabsCtx)
  if (active !== value) return null
  return <div className={className}>{children}</div>
}
