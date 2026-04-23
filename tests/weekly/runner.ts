#!/usr/bin/env tsx
/**
 * Halo Daily Test Runner
 * Runs the full test suite every time it's called.
 * Schedule this with cron to run daily.
 *
 * Usage:
 *   npx tsx tests/weekly/runner.ts
 *
 * Cron (run every day at 9am):
 *   0 9 * * * cd /path/to/halo && HALO_BASE_URL=http://... HALO_CP_URL=http://... npx tsx tests/weekly/runner.ts
 */

import { execSync } from 'child_process'
import { resolve } from 'path'

function main() {
  const date = new Date().toISOString().slice(0, 10)

  if (!process.env.HALO_BASE_URL) {
    console.warn('⚠️  HALO_BASE_URL not set — defaulting to http://localhost:3000')
  }
  if (!process.env.HALO_CP_URL) {
    console.warn('⚠️  HALO_CP_URL not set — defaulting to http://localhost:3001')
  }

  console.log(`\n📅 Halo Test Run — ${date}`)

  const script = resolve('tests/weekly/daily.ts')
  try {
    execSync(`npx tsx ${script}`, { stdio: 'inherit', env: { ...process.env } })
    console.log('\n✅ Run complete — results in FINDINGS.md')
  } catch (err: unknown) {
    const code = (err as { status?: number }).status ?? 1
    console.log(`\n⚠️  Run finished with ${code > 0 ? 'failures' : 'success'} — see FINDINGS.md`)
    process.exit(code)
  }
}

main()
