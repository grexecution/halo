/**
 * F-019: Voice in/out on dashboard
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoiceRecorder } from '../app/components/VoiceRecorder.js'

describe('F-019: Voice in/out on dashboard', () => {
  it('renders mic button', () => {
    render(<VoiceRecorder />)
    expect(screen.getByTestId('mic-button')).toBeTruthy()
  })

  it('shows idle state initially', () => {
    render(<VoiceRecorder />)
    expect(screen.getByTestId('recorder-state').textContent).toBe('idle')
  })

  it('transitions to recording state on mic click', () => {
    render(<VoiceRecorder />)
    fireEvent.click(screen.getByTestId('mic-button'))
    expect(screen.getByTestId('recorder-state').textContent).toBe('recording')
  })

  it('calls onTranscript when recording completes', async () => {
    const onTranscript = vi.fn()
    render(<VoiceRecorder onTranscript={onTranscript} />)
    fireEvent.click(screen.getByTestId('mic-button'))
    fireEvent.click(screen.getByTestId('mic-button'))
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Transcribed voice input'))
  })
})
