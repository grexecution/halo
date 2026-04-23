export const dynamic = 'force-dynamic'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextResponse } from 'next/server'

interface FeatureResult {
  id: string
  title: string
  result: 'pass' | 'fail' | 'regression'
  ts: string
}

interface NightlyResult {
  date: string
  status: string
  run_id: string
}

interface StuckFile {
  path: string
  content: string
}

function getRecentRegressions(): FeatureResult[] {
  const histPath = resolve(process.cwd(), 'artifacts/feature-history.jsonl')
  if (!existsSync(histPath)) return []
  const lines = readFileSync(histPath, 'utf-8').trim().split('\n').filter(Boolean)
  const results: FeatureResult[] = []
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as FeatureResult
      if (entry.result === 'regression') results.push(entry)
    } catch {
      /* skip */
    }
  }
  return results.slice(-20)
}

function getNightlyResults(): NightlyResult[] {
  const nightlyDir = resolve(process.cwd(), 'artifacts/nightly')
  if (!existsSync(nightlyDir)) return []
  const files = readdirSync(nightlyDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 7)
  return files.map((f) => {
    try {
      return JSON.parse(readFileSync(resolve(nightlyDir, f), 'utf-8')) as NightlyResult
    } catch {
      return { date: f.replace('.json', ''), status: 'unknown', run_id: '' }
    }
  })
}

function getStuckFiles(): StuckFile[] {
  // Walk common locations for STUCK.md
  const roots = [
    resolve(process.cwd(), 'services'),
    resolve(process.cwd(), 'packages'),
    resolve(process.cwd(), 'apps'),
  ]
  const found: StuckFile[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const entries = readdirSync(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const stuckPath = resolve(root, entry.name, 'STUCK.md')
      if (existsSync(stuckPath)) {
        found.push({
          path: `${entry.name}/STUCK.md`,
          content: readFileSync(stuckPath, 'utf-8').slice(0, 500),
        })
      }
    }
  }
  return found
}

export function GET() {
  return NextResponse.json({
    regressions: getRecentRegressions(),
    nightly: getNightlyResults(),
    stuckFiles: getStuckFiles(),
  })
}
