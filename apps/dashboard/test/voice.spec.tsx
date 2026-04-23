/**
 * F-019: Voice in/out on dashboard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoiceRecorder } from '../app/components/VoiceRecorder.js'

// Mock MediaRecorder + getUserMedia — not available in jsdom
const mockStart = vi.fn()
const mockTracks = [{ stop: vi.fn() }]

beforeEach(() => {
  vi.clearAllMocks()

  // Mock navigator.mediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => mockTracks,
      }),
    },
  })

  // Mock MediaRecorder
  const MockMediaRecorder = vi.fn().mockImplementation(function (this: {
    ondataavailable: null | ((e: { data: Blob }) => void)
    onstop: null | (() => void)
    start: () => void
    stop: () => void
  }) {
    this.ondataavailable = null
    this.onstop = null
    this.start = mockStart
    this.stop = vi.fn().mockImplementation(() => {
      // Simulate data + stop event
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(['audio']) })
      if (this.onstop) this.onstop()
    })
  }) as unknown as typeof MediaRecorder
  ;(MockMediaRecorder as unknown as { isTypeSupported: () => boolean }).isTypeSupported = () => true
  global.MediaRecorder = MockMediaRecorder

  // Mock FileReader so blobToBase64 works
  const MockFileReader = vi.fn().mockImplementation(function (this: {
    result: string
    onloadend: null | (() => void)
    onerror: null | (() => void)
    readAsDataURL: (blob: Blob) => void
  }) {
    this.result = 'data:audio/webm;base64,dGVzdA=='
    this.onloadend = null
    this.onerror = null
    this.readAsDataURL = vi.fn().mockImplementation(() => {
      if (this.onloadend) this.onloadend()
    })
  })
  global.FileReader = MockFileReader as unknown as typeof FileReader

  // Mock fetch for transcription
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ transcript: 'Transcribed voice input' }),
  } as Response)
})

describe('F-019: Voice in/out on dashboard', () => {
  it('renders mic button', () => {
    render(<VoiceRecorder />)
    expect(screen.getByTestId('mic-button')).toBeTruthy()
  })

  it('shows idle state initially', () => {
    render(<VoiceRecorder />)
    // state span is empty when idle
    expect(screen.getByTestId('recorder-state').textContent).toBe('')
  })

  it('transitions to recording state on mic click', async () => {
    render(<VoiceRecorder />)
    fireEvent.click(screen.getByTestId('mic-button'))
    await waitFor(() => expect(screen.getByTestId('recorder-state').textContent).toBe('Recording…'))
  })

  it('calls onTranscript when recording completes', async () => {
    const onTranscript = vi.fn()
    render(<VoiceRecorder onTranscript={onTranscript} />)
    // Start recording
    fireEvent.click(screen.getByTestId('mic-button'))
    // Wait for recording state
    await waitFor(() => expect(screen.getByTestId('recorder-state').textContent).toBe('Recording…'))
    // Stop recording
    fireEvent.click(screen.getByTestId('mic-button'))
    // Wait for transcript callback
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Transcribed voice input'), {
      timeout: 3000,
    })
  })
})
