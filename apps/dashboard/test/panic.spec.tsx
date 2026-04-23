/**
 * F-044: Panic button
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PanicButton } from '../app/components/PanicButton.js'

beforeEach(() => {
  // Provide a fetch mock that resolves immediately
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
})

describe('F-044: Panic button', () => {
  it('renders a PANIC button', () => {
    render(<PanicButton />)
    expect(screen.getByTestId('panic-button')).toBeTruthy()
  })

  it('calls onPanic callback when clicked', async () => {
    const onPanic = vi.fn()
    render(<PanicButton onPanic={onPanic} />)
    fireEvent.click(screen.getByTestId('panic-button'))
    await waitFor(() => expect(onPanic).toHaveBeenCalledOnce())
  })

  it('disables the button after panic is triggered', async () => {
    render(<PanicButton />)
    const btn = screen.getByTestId('panic-button')
    fireEvent.click(btn)
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true))
  })

  it('shows triggered state in button text after click', async () => {
    render(<PanicButton />)
    fireEvent.click(screen.getByTestId('panic-button'))
    await waitFor(() => expect(screen.getByTestId('panic-button').textContent).toContain('STOPPED'))
  })
})
