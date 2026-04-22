import type { LabelHTMLAttributes } from 'react'
import { cn } from './cn'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-xs font-medium text-gray-400 mb-1.5', className)} {...props} />
  )
}
