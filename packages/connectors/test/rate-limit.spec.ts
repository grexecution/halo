/**
 * F-137: Rate-limit backoff for external APIs
 */
import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '../src/index.js'

describe('F-137: Rate-limit backoff', () => {
  it('succeeds on a non-rate-limited call immediately', async () => {
    const limiter = createRateLimiter({ baseDelayMs: 10 })
    const result = await limiter.attempt(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('retries on 429 error and eventually succeeds', async () => {
    const limiter = createRateLimiter({ maxRetries: 3, baseDelayMs: 5 })
    let calls = 0
    const result = await limiter.attempt(async () => {
      calls++
      if (calls < 3) throw new Error('429 rate limit exceeded')
      return 'success'
    })
    expect(result).toBe('success')
    expect(calls).toBe(3)
  })

  it('throws after exceeding max retries', async () => {
    const limiter = createRateLimiter({ maxRetries: 2, baseDelayMs: 1 })
    await expect(
      limiter.attempt(async () => {
        throw new Error('429 rate limit')
      }),
    ).rejects.toThrow()
  })

  it('does not retry on non-rate-limit errors', async () => {
    const limiter = createRateLimiter({ maxRetries: 5, baseDelayMs: 1 })
    let calls = 0
    await expect(
      limiter.attempt(async () => {
        calls++
        throw new Error('not found')
      }),
    ).rejects.toThrow('not found')
    expect(calls).toBe(1)
  })

  it('backoff increases exponentially', () => {
    const limiter = createRateLimiter({ baseDelayMs: 100 })
    const initial = limiter.getBackoffMs()
    expect(initial).toBe(100)
  })
})
