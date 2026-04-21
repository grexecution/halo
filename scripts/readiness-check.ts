#!/usr/bin/env node
/**
 * Production readiness check for claw-alt.
 * Outputs READY or NOT READY with specific gaps.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const REPO_ROOT = resolve(import.meta.dirname, '..')

interface CheckResult {
  name: string
  passed: boolean
  detail?: string | undefined
}

function check(name: string, fn: () => boolean | string): CheckResult {
  try {
    const result = fn()
    if (result === true) return { name, passed: true }
    if (result === false) return { name, passed: false }
    return { name, passed: false, detail: String(result) }
  } catch (e) {
    return { name, passed: false, detail: String(e) }
  }
}

function noPlannedFeatures(): boolean | string {
  const md = readFileSync(resolve(REPO_ROOT, 'docs/FEATURES.md'), 'utf-8')
  const plannedCount = (md.match(/\*\*Status:\*\* planned/g) ?? []).length
  if (plannedCount > 0) return `${plannedCount} features still planned`
  return true
}

function noStuckMd(): boolean | string {
  const stuckPath = resolve(REPO_ROOT, 'docs/STUCK.md')
  if (!existsSync(stuckPath)) return true
  const content = readFileSync(stuckPath, 'utf-8').trim()
  if (content.length === 0) return true
  const lines = content
    .split('\n')
    .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'))
  if (lines.length === 0) return true
  return `STUCK.md has ${lines.length} open items`
}

function featuresTestPass(): boolean | string {
  const res = spawnSync(
    'node',
    ['--import', 'tsx/esm', resolve(REPO_ROOT, 'scripts/test-features.ts')],
    {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 120_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    },
  )
  if (res.status === 0) return true
  const out = (res.stdout ?? '') + (res.stderr ?? '')
  const failLine = out.split('\n').find((l) => /\d+\/\d+ features/.test(l))
  return failLine ?? 'test:features failed'
}

function securitySuitePass(): boolean | string {
  const secFile = resolve(REPO_ROOT, 'test/security-regression/security.spec.ts')
  if (!existsSync(secFile)) return 'security.spec.ts not found'
  const res = spawnSync(
    'node',
    ['--import', 'tsx/esm', 'node_modules/vitest/vitest.mjs', 'run', secFile],
    {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 60_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    },
  )
  return res.status === 0 ? true : 'security regression tests failed'
}

function nightlyWorkflowExists(): boolean | string {
  const p = resolve(REPO_ROOT, '.github/workflows/nightly.yml')
  return existsSync(p) ? true : 'nightly.yml not found'
}

const isDryRun = process.argv.includes('--dry-run') || process.env['READINESS_DRY_RUN'] === '1'

const checks: CheckResult[] = isDryRun
  ? [
      check('No planned features remaining', noPlannedFeatures),
      check('No STUCK.md open items', noStuckMd),
      check('Nightly CI workflow exists', nightlyWorkflowExists),
    ]
  : [
      check('No planned features remaining', noPlannedFeatures),
      check('No STUCK.md open items', noStuckMd),
      check('Feature test suite passes', featuresTestPass),
      check('Security regression suite passes', securitySuitePass),
      check('Nightly CI workflow exists', nightlyWorkflowExists),
    ]

const failed = checks.filter((c) => !c.passed)
const passed = checks.filter((c) => c.passed)

for (const c of passed) {
  process.stdout.write(`✓ ${c.name}\n`)
}
for (const c of failed) {
  process.stdout.write(`✗ ${c.name}${c.detail ? `: ${c.detail}` : ''}\n`)
}

process.stdout.write('\n')
if (failed.length === 0) {
  process.stdout.write('READY\n')
  process.exit(0)
} else {
  process.stdout.write(`NOT READY — ${failed.length} gap(s)\n`)
  process.exit(1)
}
