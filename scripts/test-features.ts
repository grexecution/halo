#!/usr/bin/env node
/**
 * Feature-test runner.
 * Parses docs/FEATURES.md, finds every row with Status: done,
 * runs its test (TS via vitest, .sh via bash), tracks history.
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const FEATURES_MD = process.env['CLAW_FEATURES_MD'] ?? resolve(REPO_ROOT, 'docs/FEATURES.md')
const HISTORY_FILE =
  process.env['CLAW_HISTORY_FILE'] ?? resolve(REPO_ROOT, 'artifacts/feature-history.jsonl')

const DRY_RUN = process.env['DRY_RUN'] === '1' || process.argv.includes('--dry-run')

type FeatureStatus = 'pass' | 'fail' | 'skip' | 'regression'

interface ParsedFeature {
  id: string
  title: string
  status: string
  testPath: string
}

interface RunResult {
  id: string
  title: string
  testPath: string
  result: FeatureStatus
  error?: string
}

function parseFeatures(md: string): ParsedFeature[] {
  const features: ParsedFeature[] = []
  // Split by feature headings: "### F-NNN — Title"
  const sections = md.split(/\n(?=### F-)/)
  for (const section of sections) {
    const idMatch = section.match(/^### (F-\d+) — (.+)/)
    if (!idMatch) continue
    const id = idMatch[1] ?? ''
    const title = idMatch[2]?.trim() ?? ''
    const statusMatch = section.match(/\*\*Status:\*\*\s+(\w+[-\w]*)/)
    const testMatch = section.match(/\*\*Test:\*\*\s+`([^`]+)`/)
    if (!statusMatch || !testMatch) continue
    features.push({
      id,
      title,
      status: statusMatch[1] ?? '',
      testPath: testMatch[1] ?? '',
    })
  }
  return features
}

function loadPreviousResults(): Map<string, FeatureStatus> {
  const prev = new Map<string, FeatureStatus>()
  if (!existsSync(HISTORY_FILE)) return prev
  const lines = readFileSync(HISTORY_FILE, 'utf-8').trim().split('\n')
  // Only look at the last run (last line per feature ID)
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line) as { id: string; result: FeatureStatus }
      prev.set(entry.id, entry.result)
    } catch {
      // skip malformed lines
    }
  }
  return prev
}

function runTsTest(testPath: string): { ok: boolean; output: string } {
  const abs = resolve(REPO_ROOT, testPath)
  if (!existsSync(abs)) {
    return { ok: false, output: `Test file not found: ${testPath}` }
  }
  const res = spawnSync(
    'node',
    ['--import', 'tsx/esm', 'node_modules/vitest/vitest.mjs', 'run', abs],
    {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
      timeout: 120_000,
    },
  )
  const output = (res.stdout ?? '') + (res.stderr ?? '')
  return { ok: res.status === 0, output }
}

function runShTest(testPath: string): { ok: boolean; output: string } {
  const abs = resolve(REPO_ROOT, testPath)
  if (!existsSync(abs)) {
    return { ok: false, output: `Test script not found: ${testPath}` }
  }
  const res = spawnSync('bash', [abs], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
  })
  const output = (res.stdout ?? '') + (res.stderr ?? '')
  return { ok: res.status === 0, output }
}

function runTest(testPath: string): { ok: boolean; output: string } {
  const ext = extname(testPath)
  if (ext === '.sh') return runShTest(testPath)
  return runTsTest(testPath)
}

function appendHistory(results: RunResult[]): void {
  const dir = resolve(REPO_ROOT, 'artifacts')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const ts = new Date().toISOString()
  for (const r of results) {
    appendFileSync(HISTORY_FILE, JSON.stringify({ ...r, ts }) + '\n', 'utf-8')
  }
}

function main(): void {
  const md = readFileSync(FEATURES_MD, 'utf-8')
  const features = parseFeatures(md)
  const done = features.filter((f) => f.status === 'done')

  process.stdout.write(`Parsed features: ${features.length} total, ${done.length} done\n`)

  if (DRY_RUN) {
    process.stdout.write(`[dry-run] Would run ${done.length} tests\n`)
    const list = done.map((f) => `  ${f.id}: ${f.testPath}`).join('\n')
    if (list) process.stdout.write(list + '\n')
    process.stdout.write(`0/${done.length} features (dry-run)\n`)
    return
  }

  const prev = loadPreviousResults()
  const results: RunResult[] = []
  let passes = 0
  let failures = 0
  let regressions = 0

  for (const f of done) {
    const { ok, output } = runTest(f.testPath)
    const wasPass = prev.get(f.id) === 'pass'
    let result: FeatureStatus
    if (ok) {
      result = 'pass'
      passes++
    } else if (wasPass) {
      result = 'regression'
      regressions++
    } else {
      result = 'fail'
      failures++
    }
    const label = result === 'regression' ? 'REGRESSION' : result.toUpperCase()
    process.stdout.write(`${label}: ${f.id} — ${f.title}\n`)
    if (!ok) process.stdout.write(`  ${output.slice(0, 500)}\n`)
    results.push({
      id: f.id,
      title: f.title,
      testPath: f.testPath,
      result,
      error: ok ? undefined : output,
    })
  }

  appendHistory(results)

  const total = done.length
  process.stdout.write(`\n${passes}/${total} features passing`)
  if (regressions > 0) process.stdout.write(`, ${regressions} REGRESSION(S)`)
  if (failures > 0) process.stdout.write(`, ${failures} FAIL(S)`)
  process.stdout.write('\n')

  if (failures > 0 || regressions > 0) process.exit(1)
}

main()
