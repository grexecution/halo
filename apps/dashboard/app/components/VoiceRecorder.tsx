'use client'

import { useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'processing' | 'done'

interface VoiceRecorderProps {
  onTranscript?: (text: string) => void
}

export function VoiceRecorder({ onTranscript }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')

  function handleMicClick() {
    if (state === 'idle') {
      setState('recording')
    } else if (state === 'recording') {
      setState('processing')
      // Simulate transcription round-trip
      setTimeout(() => {
        setState('done')
        onTranscript?.('Transcribed voice input')
      }, 100)
    }
  }

  return (
    <div data-testid="voice-recorder">
      <button
        data-testid="mic-button"
        onClick={handleMicClick}
        className={`p-3 rounded-full ${
          state === 'recording'
            ? 'bg-red-500 text-white'
            : state === 'processing'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-200 text-gray-700'
        }`}
        aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
      >
        {state === 'recording' ? 'Stop' : state === 'processing' ? '...' : 'Mic'}
      </button>
      <span data-testid="recorder-state" className="ml-2 text-sm text-gray-500">
        {state}
      </span>
    </div>
  )
}
