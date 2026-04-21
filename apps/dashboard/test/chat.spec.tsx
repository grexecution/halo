/**
 * F-010: Chat page with streaming
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatPage from '../app/chat/page.js'

describe('F-010: Chat page', () => {
  it('renders chat input and send button', () => {
    render(<ChatPage />)
    expect(screen.getByTestId('chat-input')).toBeDefined()
    expect(screen.getByTestId('send-button')).toBeDefined()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatPage />)
    const btn = screen.getByTestId('send-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('send button becomes enabled when text is typed', () => {
    render(<ChatPage />)
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello' } })
    const btn = screen.getByTestId('send-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('shows empty message list initially', () => {
    render(<ChatPage />)
    const list = screen.getByTestId('message-list')
    expect(list.children.length).toBe(0)
  })
})
