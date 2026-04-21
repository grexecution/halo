/**
 * F-011: Sub-agent tabs
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SubAgentTabs from '../app/components/SubAgentTabs.js'

describe('F-011: Sub-agent tabs', () => {
  it('renders tabs for each agent', () => {
    render(
      <SubAgentTabs
        agents={[
          { id: 'main', handle: 'claw', name: 'Claw' },
          { id: 'coder', handle: 'coder', name: 'Coder' },
        ]}
        activeTab="main"
        onTabChange={() => {}}
      />,
    )
    expect(screen.getByTestId('tab-main')).toBeDefined()
    expect(screen.getByTestId('tab-coder')).toBeDefined()
  })

  it('active tab is highlighted', () => {
    render(
      <SubAgentTabs
        agents={[
          { id: 'main', handle: 'claw', name: 'Claw' },
          { id: 'coder', handle: 'coder', name: 'Coder' },
        ]}
        activeTab="coder"
        onTabChange={() => {}}
      />,
    )
    const coderTab = screen.getByTestId('tab-coder')
    expect(coderTab.className).toContain('active')
  })

  it('switching tabs calls onTabChange with new id', () => {
    const onChange = vi.fn()
    render(
      <SubAgentTabs
        agents={[
          { id: 'main', handle: 'claw', name: 'Claw' },
          { id: 'coder', handle: 'coder', name: 'Coder' },
        ]}
        activeTab="main"
        onTabChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('tab-coder'))
    expect(onChange).toHaveBeenCalledWith('coder')
  })
})
