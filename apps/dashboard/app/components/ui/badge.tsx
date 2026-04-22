import type { HTMLAttributes } from 'react'
import { cn } from './cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
}

const variants = {
  default: 'bg-gray-800 text-gray-300 border border-gray-700',
  success: 'bg-green-900/40 text-green-400 border border-green-800',
  warning: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  danger: 'bg-red-900/40 text-red-400 border border-red-800',
  info: 'bg-blue-900/40 text-blue-400 border border-blue-800',
  muted: 'bg-gray-800/50 text-gray-600 border border-gray-800',
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium font-mono',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
