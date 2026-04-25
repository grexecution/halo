'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from './cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]',
          className,
        )}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors ml-4 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
