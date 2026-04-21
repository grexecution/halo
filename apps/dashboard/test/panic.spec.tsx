/**
 * F-044: Panic button
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanicButton } from '../app/components/PanicButton.js'

describe('F-044: Panic button', () => {
  it('renders a PANIC button', () => {
    render(<PanicButton />)
    expect(screen.getByTestId('panic-button')).toBeTruthy()
  })

  it('calls onPanic callback when clicked', () => {
    const onPanic = vi.fn()
    render(<PanicButton onPanic={onPanic} />)
    fireEvent.click(screen.getByTestId('panic-button'))
    expect(onPanic).toHaveBeenCalledOnce()
  })

  it('disables the button after panic is triggered', () => {
    render(<PanicButton />)
    const btn = screen.getByTestId('panic-button')
    fireEvent.click(btn)
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows triggered state in button text after click', () => {
    render(<PanicButton />)
    fireEvent.click(screen.getByTestId('panic-button'))
    expect(screen.getByTestId('panic-button').textContent).toContain('TRIGGERED')
  })
})
