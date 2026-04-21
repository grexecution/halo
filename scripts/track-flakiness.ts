#!/usr/bin/env node
/**
 * F-165: Flakiness tracker.
 * Appends a flakiness entry to artifacts/flakiness.jsonl.
 * Usage: tsx scripts/track-flakiness.ts --test <file> [--out <path>] [--pass|--fail]
 */
import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_OUT = resolve(REPO_ROOT, 'artifacts/flakiness.jsonl')

function parseArgs(argv: string[]): { testFile?: string; outFile: string; passed: boolean } {
  const args = argv.slice(2)
  let testFile: string | undefined
  let outFile = DEFAULT_OUT
  let passed = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test' && args[i + 1]) {
      testFile = args[++i]
    } else if (args[i] === '--out' && args[i + 1]) {
      outFile = args[++i] as string
    } else if (args[i] === '--pass') {
      passed = true
    } else if (args[i] === '--fail') {
      passed = false
    }
  }
  return { testFile, outFile, passed }
}

function main(): void {
  const { testFile, outFile, passed } = parseArgs(process.argv)

  if (!testFile) {
    process.stderr.write('Usage: track-flakiness.ts --test <file> [--out <path>] [--pass|--fail]\n')
    process.exit(1)
  }

  const dir = dirname(outFile)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const entry = {
    testFile,
    passed,
    ts: new Date().toISOString(),
  }

  appendFileSync(outFile, JSON.stringify(entry) + '\n', 'utf-8')
}

main()
