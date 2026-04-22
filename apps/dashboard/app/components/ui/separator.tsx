import { cn } from './cn'

export function Separator({ className }: { className?: string }) {
  return <div className={cn('border-t border-gray-800', className)} />
}
