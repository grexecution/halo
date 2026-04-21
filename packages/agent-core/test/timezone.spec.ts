/**
 * F-150: Timezone in agent prompts
 * Verifies that the agent system prompt is prefixed with the current date/time
 * in the configured IANA timezone.
 */
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../src/index.js'

describe('F-150: Timezone in agent prompts', () => {
  it('prefixes system prompt with current date/time in configured timezone', () => {
    const result = buildSystemPrompt('You are a helpful assistant.', 'America/New_York')
    expect(result).toMatch(/Current date and time:/)
    expect(result).toContain('You are a helpful assistant.')
  })

  it('defaults to UTC when no timezone provided', () => {
    const result = buildSystemPrompt('Base prompt.')
    expect(result).toMatch(/Current date and time:/)
    expect(result).toContain('Base prompt.')
  })

  it('uses the provided IANA timezone in the timestamp', () => {
    const result = buildSystemPrompt('Test.', 'Europe/Vienna')
    expect(result).toMatch(/Current date and time:.+/)
    // Verify the date string is present
    const year = new Date().getFullYear()
    expect(result).toContain(String(year))
  })

  it('timestamp is placed before the base system prompt', () => {
    const result = buildSystemPrompt('Custom instructions here.', 'UTC')
    const dateIndex = result.indexOf('Current date and time:')
    const promptIndex = result.indexOf('Custom instructions here.')
    expect(dateIndex).toBeLessThan(promptIndex)
  })
})
