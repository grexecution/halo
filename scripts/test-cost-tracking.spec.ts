import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, unlinkSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')

describe('F-169: Cost tracking per build session', () => {
  it('scripts/build-cost.ts exists', () => {
    expect(existsSync(resolve(REPO_ROOT, 'scripts/build-cost.ts'))).toBe(true)
  })

  it('exports recordCost, checkCaps, readTotal', async () => {
    const mod = await import(resolve(REPO_ROOT, 'scripts/build-cost.ts'))
    expect(typeof mod.recordCost).toBe('function')
    expect(typeof mod.checkCaps).toBe('function')
    expect(typeof mod.readTotal).toBe('function')
  })

  describe('recordCost', () => {
    const TEST_LOG = resolve(REPO_ROOT, 'artifacts/test-build-cost.jsonl')

    afterEach(() => {
      if (existsSync(TEST_LOG)) unlinkSync(TEST_LOG)
    })

    it('appends a JSONL entry with session, tokens, cost_usd, ts', async () => {
      const { recordCost } = await import(resolve(REPO_ROOT, 'scripts/build-cost.ts'))
      await recordCost({ session: 'test-session', tokens: 1000, cost_usd: 0.003 }, TEST_LOG)
      const line = readFileSync(TEST_LOG, 'utf-8').trim()
      const entry = JSON.parse(line)
      expect(entry.session).toBe('test-session')
      expect(entry.tokens).toBe(1000)
      expect(entry.cost_usd).toBe(0.003)
      expect(typeof entry.ts).toBe('string')
    })
  })

  describe('checkCaps', () => {
    const TEST_LOG = resolve(REPO_ROOT, 'artifacts/test-build-cost-caps.jsonl')

    afterEach(() => {
      if (existsSync(TEST_LOG)) unlinkSync(TEST_LOG)
    })

    it('returns ok=true when total is below soft cap', async () => {
      const { checkCaps } = await import(resolve(REPO_ROOT, 'scripts/build-cost.ts'))
      const result = await checkCaps(5, { soft: 10, hard: 50 }, TEST_LOG)
      expect(result.ok).toBe(true)
      expect(result.level).toBe('ok')
    })

    it('returns ok=true, level=warn when total exceeds soft cap', async () => {
      const { checkCaps } = await import(resolve(REPO_ROOT, 'scripts/build-cost.ts'))
      const result = await checkCaps(11, { soft: 10, hard: 50 }, TEST_LOG)
      expect(result.ok).toBe(true)
      expect(result.level).toBe('warn')
    })

    it('returns ok=false, level=hard when total exceeds hard cap', async () => {
      const { checkCaps } = await import(resolve(REPO_ROOT, 'scripts/build-cost.ts'))
      const result = await checkCaps(51, { soft: 10, hard: 50 }, TEST_LOG)
      expect(result.ok).toBe(false)
      expect(result.level).toBe('hard')
    })
  })

  describe('readTotal', () => {
    const TEST_LOG = resolve(REPO_ROOT, 'artifacts/test-build-cost-total.jsonl')

    afterEach(() => {
      if (existsSync(TEST_LOG)) unlinkSync(TEST_LOG)
    })

    it('returns 0 when file does not exist', async () => {
      const { readTotal } = await import(resolve(REPO_ROOT, 'scripts/build-cost.ts'))
      const total = await readTotal(TEST_LOG)
      expect(total).toBe(0)
    })

    it('sums all cost_usd entries in the JSONL file', async () => {
      const { recordCost, readTotal } = await import(
        resolve(REPO_ROOT, 'scripts/build-cost.ts'),
      )
      await recordCost({ session: 's1', tokens: 1000, cost_usd: 3.5 }, TEST_LOG)
      await recordCost({ session: 's2', tokens: 2000, cost_usd: 7.0 }, TEST_LOG)
      const total = await readTotal(TEST_LOG)
      expect(total).toBeCloseTo(10.5)
    })
  })
})
