import { cn } from './cn'

interface StatusDotProps {
  status: 'online' | 'offline' | 'pending' | 'running' | 'error'
  pulse?: boolean
}

const colors = {
  online: 'bg-green-500',
  offline: 'bg-gray-600',
  pending: 'bg-yellow-500',
  running: 'bg-blue-500',
  error: 'bg-red-500',
}

export function StatusDot({ status, pulse }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0',
        colors[status],
        pulse && 'animate-pulse',
      )}
    />
  )
}
