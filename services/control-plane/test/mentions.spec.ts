/**
 * F-022: Sub-agent mentions in chat
 */
import { describe, it, expect } from 'vitest'
import { parseMention } from '@open-greg/messaging'

describe('F-022: Sub-agent mentions', () => {
  it('parses @handle mention from message text', () => {
    const result = parseMention('@coder fix this bug in line 42')
    expect(result).not.toBeNull()
    expect(result?.handle).toBe('coder')
    expect(result?.task).toBe('fix this bug in line 42')
  })

  it('returns null when no @mention found', () => {
    const result = parseMention('Just a regular message')
    expect(result).toBeNull()
  })

  it('extracts the full task after the handle', () => {
    const result = parseMention('@reviewer please check my implementation of the auth module')
    expect(result?.handle).toBe('reviewer')
    expect(result?.task).toContain('please check')
  })

  it('handles mention at start of message', () => {
    const result = parseMention('@claw what is 2+2?')
    expect(result?.handle).toBe('claw')
  })
})
