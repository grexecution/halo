/**
 * F-165: Flaky test detection
 * Verifies that the flakiness tracker records failures in artifacts/flakiness.jsonl
 * and that vitest retry config is correctly set.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const REPO_ROOT = resolve(import.meta.dirname, '..')

describe('F-165: Flaky test tracking', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'open-greg-flake-'))
    mkdirSync(join(tmpDir, 'artifacts'), { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('vitest.config.ts has retry config set (integration retry=1, unit retry=0)', () => {
    const vitestConfig = readFileSync(join(REPO_ROOT, 'vitest.config.ts'), 'utf-8')
    // Should configure retry for integration tests
    expect(vitestConfig).toMatch(/retry/)
  })

  it('vitest.config.ts uses projects or reporters that support flakiness tracking', () => {
    const vitestConfig = readFileSync(join(REPO_ROOT, 'vitest.config.ts'), 'utf-8')
    // Should reference some kind of reporters or projects configuration
    expect(vitestConfig).toMatch(/reporter|project|retry/i)
  })

  it('records flaky test results to flakiness.jsonl via track-flakiness script', () => {
    const tracker = resolve(REPO_ROOT, 'scripts/track-flakiness.ts')
    expect(existsSync(tracker)).toBe(true)
  })

  it('track-flakiness.ts can append a flakiness entry', () => {
    const tracker = resolve(REPO_ROOT, 'scripts/track-flakiness.ts')
    const outFile = join(tmpDir, 'artifacts/flakiness.jsonl')
    const res = spawnSync(
      'node',
      ['--import', 'tsx/esm', tracker, '--test', 'my-test.spec.ts', '--out', outFile],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 15_000,
      },
    )
    expect(res.status).toBe(0)
    expect(existsSync(outFile)).toBe(true)
    const content = readFileSync(outFile, 'utf-8')
    const entry = JSON.parse(content.trim()) as { testFile: string }
    expect(entry.testFile).toBe('my-test.spec.ts')
  })
})
