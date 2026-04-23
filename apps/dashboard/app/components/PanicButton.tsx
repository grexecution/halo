'use client'

import { useState } from 'react'

interface PanicButtonProps {
  onPanic?: () => void
}

export function PanicButton({ onPanic }: PanicButtonProps) {
  const [triggered, setTriggered] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handlePanic() {
    if (triggered || loading) return
    setLoading(true)
    try {
      await fetch('/api/panic', { method: 'POST' })
    } catch {
      // Still trigger UI even if fetch fails
    }
    setTriggered(true)
    setLoading(false)
    onPanic?.()
    // Auto-reset after 5 s so user can panic again
    setTimeout(() => setTriggered(false), 5_000)
  }

  return (
    <button
      data-testid="panic-button"
      onClick={handlePanic}
      disabled={triggered || loading}
      className="bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-bold py-3 px-6 rounded-lg transition-colors"
    >
      {loading ? 'STOPPING…' : triggered ? 'STOPPED ✓' : 'PANIC'}
    </button>
  )
}
