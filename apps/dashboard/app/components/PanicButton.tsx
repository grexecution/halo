'use client'

import { useState } from 'react'

interface PanicButtonProps {
  onPanic?: () => void
}

export function PanicButton({ onPanic }: PanicButtonProps) {
  const [triggered, setTriggered] = useState(false)

  function handlePanic() {
    setTriggered(true)
    onPanic?.()
  }

  return (
    <button
      data-testid="panic-button"
      onClick={handlePanic}
      disabled={triggered}
      className="bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-bold py-3 px-6 rounded-lg"
    >
      {triggered ? 'PANIC TRIGGERED' : 'PANIC'}
    </button>
  )
}
