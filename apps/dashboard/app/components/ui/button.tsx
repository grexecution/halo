import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const variants = {
  default: 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50',
  outline:
    'border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50',
  ghost: 'text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-50',
  destructive:
    'bg-red-900/40 text-red-400 border border-red-800 hover:bg-red-900/70 disabled:opacity-50',
  secondary: 'bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-50',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-sm rounded-lg',
  icon: 'p-2 rounded-lg',
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
