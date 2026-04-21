/**
 * F-136: Pino redaction tests
 * Verifies that sensitive field names are automatically redacted in log output.
 */
import { describe, it, expect } from 'vitest'
import { createLogger, REDACTED_FIELDS } from '../src/index.js'
import { Writable } from 'node:stream'

function captureLog(fn: (log: ReturnType<typeof createLogger>) => void): string {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      chunks.push(chunk.toString())
      cb()
    },
  })
  const log = createLogger({ stream })
  fn(log)
  return chunks.join('')
}

describe('F-136: Pino redaction', () => {
  it('exports REDACTED_FIELDS list', () => {
    expect(Array.isArray(REDACTED_FIELDS)).toBe(true)
    expect(REDACTED_FIELDS.length).toBeGreaterThan(0)
  })

  it('redacts apiKey field', () => {
    const output = captureLog((log) => log.info({ apiKey: 'sk-1234567890' }, 'test'))
    expect(output).not.toContain('sk-1234567890')
    expect(output).toContain('[Redacted]')
  })

  it('redacts password field', () => {
    const output = captureLog((log) => log.info({ password: 'supersecret' }, 'test'))
    expect(output).not.toContain('supersecret')
    expect(output).toContain('[Redacted]')
  })

  it('redacts authorization field', () => {
    const output = captureLog((log) => log.info({ authorization: 'Bearer sk-abc' }, 'test'))
    expect(output).not.toContain('Bearer sk-abc')
    expect(output).toContain('[Redacted]')
  })

  it('redacts secret field', () => {
    const output = captureLog((log) => log.info({ secret: 'my-secret-value' }, 'test'))
    expect(output).not.toContain('my-secret-value')
    expect(output).toContain('[Redacted]')
  })

  it('does NOT redact non-sensitive fields', () => {
    const output = captureLog((log) => log.info({ message: 'hello world', userId: '123' }, 'test'))
    expect(output).toContain('hello world')
    expect(output).toContain('123')
  })

  it('redacts nested sensitive fields via path notation', () => {
    const output = captureLog((log) =>
      log.info({ headers: { authorization: 'Bearer token123' } }, 'test'),
    )
    expect(output).not.toContain('token123')
  })
})
