/**
 * F-162: Regression detection tests
 * Verifies that test-features.ts labels previously-passing features
 * that now fail as REGRESSION rather than plain FAIL.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const RUNNER = resolve(REPO_ROOT, 'scripts/test-features.ts')

function makeHistoryLine(id: string, result: 'pass' | 'fail' | 'regression'): string {
  return (
    JSON.stringify({ id, title: 'test', testPath: 'x.ts', result, ts: new Date().toISOString() }) +
    '\n'
  )
}

describe('F-162: Regression detection', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'open-greg-regression-'))
    mkdirSync(join(tmpDir, 'artifacts'), { recursive: true })
    mkdirSync(join(tmpDir, 'scripts'), { recursive: true })
    mkdirSync(join(tmpDir, 'docs'), { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('labels a previously-passing feature that now fails as REGRESSION', () => {
    // Write a minimal FEATURES.md with one done feature pointing at a missing test (will fail)
    writeFileSync(
      join(tmpDir, 'docs/FEATURES.md'),
      `# Features Registry\n\n### F-999 — Test feature\n\n**Status:** done · **Phase:** 2\n**Spec:** test.\n**Acceptance:** test.\n**Test:** \`scripts/nonexistent.spec.ts\`\n`,
    )

    // Write history saying F-999 previously passed
    writeFileSync(join(tmpDir, 'artifacts/feature-history.jsonl'), makeHistoryLine('F-999', 'pass'))

    // Run the feature runner with our custom env pointing at the tmpDir
    const res = spawnSync('node', ['--import', 'tsx/esm', RUNNER], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        CLAW_FEATURES_MD: join(tmpDir, 'docs/FEATURES.md'),
        CLAW_HISTORY_FILE: join(tmpDir, 'artifacts/feature-history.jsonl'),
      },
      timeout: 30_000,
    })
    const output = (res.stdout ?? '') + (res.stderr ?? '')
    // Should contain REGRESSION label, not just FAIL
    expect(output).toContain('REGRESSION: F-999')
    expect(output).not.toMatch(/^FAIL: F-999/m)
  })

  it('labels a never-seen failing feature as FAIL (not REGRESSION)', () => {
    writeFileSync(
      join(tmpDir, 'docs/FEATURES.md'),
      `# Features Registry\n\n### F-998 — New failing feature\n\n**Status:** done · **Phase:** 2\n**Spec:** test.\n**Acceptance:** test.\n**Test:** \`scripts/nonexistent.spec.ts\`\n`,
    )

    // No history file → F-998 was never seen before
    const res = spawnSync('node', ['--import', 'tsx/esm', RUNNER], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        CLAW_FEATURES_MD: join(tmpDir, 'docs/FEATURES.md'),
        CLAW_HISTORY_FILE: join(tmpDir, 'artifacts/feature-history.jsonl'),
      },
      timeout: 30_000,
    })
    const output = (res.stdout ?? '') + (res.stderr ?? '')
    expect(output).toContain('FAIL: F-998')
    expect(output).not.toContain('REGRESSION')
  })

  it('appends run results to history file', () => {
    writeFileSync(
      join(tmpDir, 'docs/FEATURES.md'),
      `# Features Registry\n\n### F-997 — History test\n\n**Status:** done · **Phase:** 2\n**Spec:** test.\n**Acceptance:** test.\n**Test:** \`scripts/nonexistent.spec.ts\`\n`,
    )

    spawnSync('node', ['--import', 'tsx/esm', RUNNER], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        CLAW_FEATURES_MD: join(tmpDir, 'docs/FEATURES.md'),
        CLAW_HISTORY_FILE: join(tmpDir, 'artifacts/feature-history.jsonl'),
      },
      timeout: 30_000,
    })
    const history = readFileSync(join(tmpDir, 'artifacts/feature-history.jsonl'), 'utf-8')
    expect(history).toContain('F-997')
  })
})
