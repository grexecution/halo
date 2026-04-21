/**
 * F-132: Approval flow (dashboard)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApprovalModal } from '../app/components/ApprovalModal.js'

describe('F-132: Approval flow (dashboard)', () => {
  it('renders approval modal with action description', () => {
    render(
      <ApprovalModal action="email.send to alice@example.com" onAllow={vi.fn()} onDeny={vi.fn()} />,
    )
    expect(screen.getByTestId('approval-modal')).toBeTruthy()
    expect(screen.getByTestId('approval-action').textContent).toContain('email.send')
  })

  it('calls onAllow when Allow button is clicked', () => {
    const onAllow = vi.fn()
    render(<ApprovalModal action="email.send" onAllow={onAllow} onDeny={vi.fn()} />)
    fireEvent.click(screen.getByTestId('approval-allow'))
    expect(onAllow).toHaveBeenCalledOnce()
  })

  it('calls onDeny when Deny button is clicked', () => {
    const onDeny = vi.fn()
    render(<ApprovalModal action="shell.exec" onAllow={vi.fn()} onDeny={onDeny} />)
    fireEvent.click(screen.getByTestId('approval-deny'))
    expect(onDeny).toHaveBeenCalledOnce()
  })

  it('displays timeout information', () => {
    render(
      <ApprovalModal action="fs.write" onAllow={vi.fn()} onDeny={vi.fn()} timeoutSeconds={300} />,
    )
    expect(screen.getByText(/300s/)).toBeTruthy()
  })
})
