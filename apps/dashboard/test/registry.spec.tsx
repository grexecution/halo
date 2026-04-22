/**
 * F-017: Registry overview page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RegistryPage from '../app/registry/page.js'

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/models')
      return Promise.resolve({
        ok: true,
        json: async () => ({
          models: [
            {
              id: 'ollama-default',
              name: 'Llama 3.2 (local)',
              provider: 'ollama',
              available: true,
            },
            {
              id: 'anthropic-claude',
              name: 'Claude (Anthropic)',
              provider: 'anthropic',
              available: false,
            },
          ],
        }),
      } as Response)
    if (url === '/api/settings')
      return Promise.resolve({
        ok: true,
        json: async () => ({
          llm: { primary: 'ollama-default', models: [] },
          permissions: {
            toolsEnabled: { shell: false, browser: true, filesystem: false, gui: false },
          },
        }),
      } as Response)
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
  })
})

describe('F-017: Registry overview page', () => {
  it('renders the registry page', () => {
    render(<RegistryPage />)
    expect(screen.getByText('Registry')).toBeDefined()
  })

  it('shows LLM providers section', () => {
    render(<RegistryPage />)
    expect(screen.getByTestId('registry-category-llm')).toBeDefined()
  })

  it('shows MCP category', () => {
    render(<RegistryPage />)
    expect(screen.getByTestId('registry-category-mcp')).toBeDefined()
  })

  it('shows tools section', () => {
    render(<RegistryPage />)
    expect(screen.getByTestId('registry-category-tools')).toBeDefined()
  })
})
