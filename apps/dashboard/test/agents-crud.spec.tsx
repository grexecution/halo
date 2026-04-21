/**
 * F-012: Agents CRUD page
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AgentsPage from '../app/agents/page.js'

describe('F-012: Agents CRUD page', () => {
  it('renders the agents list with a default agent', () => {
    render(<AgentsPage />)
    expect(screen.getByTestId('agent-list')).toBeDefined()
    expect(screen.getByTestId('agent-item-claw')).toBeDefined()
  })

  it('shows the new agent form', () => {
    render(<AgentsPage />)
    expect(screen.getByTestId('agent-form')).toBeDefined()
    expect(screen.getByTestId('handle-input')).toBeDefined()
    expect(screen.getByTestId('name-input')).toBeDefined()
  })

  it('save button is disabled when handle is empty', () => {
    render(<AgentsPage />)
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('can create a new agent', () => {
    render(<AgentsPage />)
    const handleInput = screen.getByTestId('handle-input') as HTMLInputElement
    const nameInput = screen.getByTestId('name-input') as HTMLInputElement
    fireEvent.change(handleInput, { target: { value: 'coder' } })
    fireEvent.change(nameInput, { target: { value: 'Coder Agent' } })
    const btn = screen.getByTestId('save-agent-button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(screen.getByTestId('agent-item-coder')).toBeDefined()
  })

  it('can delete an agent', () => {
    render(<AgentsPage />)
    const deleteBtn = screen.getByTestId('delete-claw')
    fireEvent.click(deleteBtn)
    expect(screen.queryByTestId('agent-item-claw')).toBeNull()
  })
})
