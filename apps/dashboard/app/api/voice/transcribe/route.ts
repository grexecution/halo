import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/voice/transcribe
 * Body: { audio: string }  — base64 WAV/WebM data
 *
 * Tries voice-service first (http://localhost:3002/transcribe).
 * Falls back to OpenAI Whisper if OPENAI_API_KEY is set.
 * Returns { transcript: string }.
 */
export async function POST(req: NextRequest) {
  const { audio } = (await req.json()) as { audio?: string }
  if (!audio) return NextResponse.json({ error: 'audio required' }, { status: 400 })

  // Try local voice-service first
  try {
    const res = await fetch('http://localhost:3002/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio }),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) {
      const data = (await res.json()) as { transcript?: string }
      return NextResponse.json({ transcript: data.transcript ?? '' })
    }
  } catch {
    // Voice service not running — fall through to Whisper
  }

  // Fallback: OpenAI Whisper API
  const apiKey = process.env['OPENAI_API_KEY']
  if (apiKey) {
    try {
      const buffer = Buffer.from(audio, 'base64')
      const formData = new FormData()
      formData.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm')
      formData.append('model', 'whisper-1')
      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30_000),
      })
      if (whisperRes.ok) {
        const data = (await whisperRes.json()) as { text?: string }
        return NextResponse.json({ transcript: data.text ?? '' })
      }
    } catch {
      // Whisper failed too
    }
  }

  return NextResponse.json(
    { error: 'Voice transcription unavailable. Connect a voice service or set OPENAI_API_KEY.' },
    { status: 503 },
  )
}
