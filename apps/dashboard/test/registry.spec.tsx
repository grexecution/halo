/**
 * F-017: Registry overview page
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RegistryPage from '../app/registry/page.js'

describe('F-017: Registry overview page', () => {
  it('renders the registry page', () => {
    render(<RegistryPage />)
    expect(screen.getByText('Registry')).toBeDefined()
  })

  it('shows LLM providers section', () => {
    render(<RegistryPage />)
    expect(screen.getByTestId('registry-category-llm')).toBeDefined()
  })

  it('shows Claude as active LLM', () => {
    render(<RegistryPage />)
    expect(screen.getByTestId('registry-item-claude')).toBeDefined()
  })

  it('shows MCP category', () => {
    render(<RegistryPage />)
    expect(screen.getByTestId('registry-category-mcp')).toBeDefined()
  })
})
