import type { SelectHTMLAttributes } from 'react'
import { cn } from './cn'

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white',
        'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
