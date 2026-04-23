#!/usr/bin/env tsx
/**
 * Halo Weekly Test Runner
 * Automatically determines which day to run based on a state file,
 * or accepts a --day=N argument to run a specific day.
 *
 * Usage:
 *   npx tsx tests/weekly/runner.ts           # runs the next scheduled day
 *   npx tsx tests/weekly/runner.ts --day=3   # runs day 3 specifically
 *   npx tsx tests/weekly/runner.ts --day=all # runs all days (CI mode)
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const STATE_FILE = '.test-week-state.json'
const DAYS = [1, 2, 3, 4, 5, 6, 7]

interface WeekState {
  startDate: string
  lastRun: number // day number
  runs: Record<number, { date: string; exitCode: number }>
}

function loadState(): WeekState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  }
  return { startDate: new Date().toISOString().slice(0, 10), lastRun: 0, runs: {} }
}

function saveState(state: WeekState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function runDay(day: number): number {
  const script = resolve(`tests/weekly/day${day}.ts`)
  if (!existsSync(script)) {
    console.error(`❌ Script not found: ${script}`)
    return 1
  }
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Running Day ${day} tests`)
  console.log(`${'='.repeat(60)}\n`)
  try {
    execSync(`npx tsx ${script}`, { stdio: 'inherit', env: { ...process.env } })
    return 0
  } catch (err: unknown) {
    return (err as { status?: number }).status ?? 1
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dayArg = args.find((a) => a.startsWith('--day='))?.split('=')[1]

  // Check env
  if (!process.env.HALO_BASE_URL) {
    console.warn('⚠️  HALO_BASE_URL not set — defaulting to http://localhost:3000')
  }
  if (!process.env.HALO_CP_URL) {
    console.warn('⚠️  HALO_CP_URL not set — defaulting to http://localhost:3001')
  }

  if (dayArg === 'all') {
    // CI mode: run all days
    for (const day of DAYS) {
      const code = runDay(day)
      if (code !== 0 && day !== 5) {
        // day 5 always exits 0
        console.error(`\nDay ${day} had failures — continuing anyway`)
      }
    }
    return
  }

  if (dayArg) {
    const day = parseInt(dayArg, 10)
    if (!DAYS.includes(day)) {
      console.error(`Invalid day: ${dayArg}. Must be 1-7 or "all".`)
      process.exit(1)
    }
    runDay(day)
    return
  }

  // Auto mode: determine which day to run
  const state = loadState()
  const nextDay = state.lastRun + 1

  if (nextDay > 7) {
    console.log('✅ Week 1 testing complete! Check FINDINGS.md and BACKLOG.md.')
    console.log('   To reset and start a new week: rm .test-week-state.json FINDINGS.md BACKLOG.md')
    return
  }

  const exitCode = runDay(nextDay)
  state.lastRun = nextDay
  state.runs[nextDay] = { date: new Date().toISOString().slice(0, 10), exitCode }
  saveState(state)

  console.log(`\n✓ Day ${nextDay} done. Run again tomorrow for Day ${nextDay + 1}.`)
  if (nextDay < 7) {
    console.log(`  Remaining: Days ${nextDay + 1}–7`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
