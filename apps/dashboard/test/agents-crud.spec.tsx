/**
 * F-012: Agents CRUD page
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AgentsPage from '../app/agents/page.js'

vi.stubGlobal('confirm', () => true)

describe('F-012: Agents CRUD page', () => {
  it('renders the agents list with a default agent', () => {
    render(<AgentsPage />)
    expect(screen.getByTestId('agent-list')).toBeDefined()
    expect(screen.getByTestId('agent-item-main')).toBeDefined()
  })

  it('opens the new agent form in a dialog', () => {
    render(<AgentsPage />)
    fireEvent.click(screen.getByTestId('new-agent-button'))
    expect(screen.getByTestId('agent-form')).toBeDefined()
    expect(screen.getByTestId('handle-input')).toBeDefined()
    expect(screen.getByTestId('name-input')).toBeDefined()
  })

  it('save button is disabled when handle is empty', () => {
    render(<AgentsPage />)
    fireEvent.click(screen.getByTestId('new-agent-button'))
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('can create a new agent', () => {
    render(<AgentsPage />)
    fireEvent.click(screen.getByTestId('new-agent-button'))
    fireEvent.change(screen.getByTestId('handle-input'), { target: { value: 'coder' } })
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Coder Agent' } })
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(screen.getByTestId('agent-item-coder')).toBeDefined()
  })

  it('can delete an agent', () => {
    render(<AgentsPage />)
    fireEvent.click(screen.getByTestId('delete-main'))
    expect(screen.queryByTestId('agent-item-main')).toBeNull()
  })
})
