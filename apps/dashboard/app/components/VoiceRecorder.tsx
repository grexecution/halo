'use client'

import { useRef, useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

interface VoiceRecorderProps {
  onTranscript?: (text: string) => void
}

export function VoiceRecorder({ onTranscript }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function handleMicClick() {
    if (state === 'recording') {
      // Stop recording
      mediaRef.current?.stop()
      return
    }

    if (state !== 'idle' && state !== 'done' && state !== 'error') return

    setErrorMsg('')

    // Request microphone access
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setErrorMsg('Microphone access denied')
      setState('error')
      return
    }

    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach((t) => t.stop())
      setState('processing')

      const blob = new Blob(chunksRef.current, { type: mimeType })
      const base64 = await blobToBase64(blob)

      try {
        const res = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64 }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Transcription failed')
        }
        const data = (await res.json()) as { transcript?: string }
        setState('done')
        onTranscript?.(data.transcript ?? '')
        setTimeout(() => setState('idle'), 1_500)
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Transcription failed')
        setState('error')
      }
    }

    recorder.start()
    setState('recording')
  }

  return (
    <div data-testid="voice-recorder" className="flex items-center gap-2">
      <button
        data-testid="mic-button"
        onClick={handleMicClick}
        className={`p-3 rounded-full transition-colors ${
          state === 'recording'
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : state === 'processing'
              ? 'bg-yellow-500 text-white cursor-wait'
              : state === 'error'
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
        }`}
        aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
        disabled={state === 'processing'}
      >
        {state === 'processing' ? '…' : state === 'recording' ? '⏹' : '🎙'}
      </button>
      <span data-testid="recorder-state" className="text-xs text-gray-500">
        {state === 'idle' && ''}
        {state === 'recording' && 'Recording…'}
        {state === 'processing' && 'Transcribing…'}
        {state === 'done' && 'Done'}
        {state === 'error' && (errorMsg || 'Error')}
      </span>
    </div>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Strip "data:audio/...;base64," prefix
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
