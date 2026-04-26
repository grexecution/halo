/**
 * F-107: Linear connector
 */
import { describe, it, expect } from 'vitest'
import { getPlugin } from '../src/plugins.js'

describe('F-107: Linear connector', () => {
  it('registers Linear as an OAuth project-management connector', () => {
    const plugin = getPlugin('linear')
    expect(plugin).toBeDefined()
    expect(plugin?.name).toBe('Linear')
    expect(plugin?.category).toBe('project_management')
    expect(plugin?.connectionType).toBe('oauth')
  })

  it('includes OAuth client credentials for setup', () => {
    const plugin = getPlugin('linear')
    const fieldKeys = new Set(plugin?.fields.map((field) => field.key))
    expect(fieldKeys.has('client_id')).toBe(true)
    expect(fieldKeys.has('client_secret')).toBe(true)
  })
})
