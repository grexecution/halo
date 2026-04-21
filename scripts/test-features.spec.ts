import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')

describe('F-160: Feature-test CI enforcement', () => {
  it('scripts/test-features.ts exists', () => {
    expect(existsSync(resolve(REPO_ROOT, 'scripts/test-features.ts'))).toBe(true)
  })

  it('parses docs/FEATURES.md and extracts done features', () => {
    const runner = resolve(REPO_ROOT, 'scripts/test-features.ts')
    const result = execSync(`node --import tsx/esm ${runner} --dry-run`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, DRY_RUN: '1' },
    })
    expect(result).toContain('Parsed features:')
  })

  it('outputs PASS/FAIL/REGRESSION lines for each done feature', () => {
    const runner = resolve(REPO_ROOT, 'scripts/test-features.ts')
    const result = execSync(`node --import tsx/esm ${runner} --dry-run`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, DRY_RUN: '1' },
    })
    expect(result).toMatch(/\d+\/\d+ features/)
  })

  it('.github/workflows/feature-enforcement.yml exists', () => {
    expect(
      existsSync(resolve(REPO_ROOT, '.github/workflows/feature-enforcement.yml')),
    ).toBe(true)
  })

  it('feature-enforcement workflow calls the test:features script', () => {
    const yml = readFileSync(
      resolve(REPO_ROOT, '.github/workflows/feature-enforcement.yml'),
      'utf-8',
    )
    expect(yml).toContain('test:features')
  })
})
