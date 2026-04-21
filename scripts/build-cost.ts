import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const DEFAULT_LOG = resolve(import.meta.dirname, '../artifacts/build-cost.jsonl')
const DEFAULT_SOFT_CAP = Number(process.env['BUILD_COST_SOFT_CAP_USD'] ?? 10)
const DEFAULT_HARD_CAP = Number(process.env['BUILD_COST_HARD_CAP_USD'] ?? 50)

interface CostEntry {
  session: string
  tokens: number
  cost_usd: number
  ts?: string
}

interface CostCheckResult {
  ok: boolean
  level: 'ok' | 'warn' | 'hard'
  total: number
  message: string
}

export async function recordCost(entry: CostEntry, logPath = DEFAULT_LOG): Promise<void> {
  const dir = dirname(logPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const record = { ...entry, ts: entry.ts ?? new Date().toISOString() }
  appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8')
}

export async function readTotal(logPath = DEFAULT_LOG): Promise<number> {
  if (!existsSync(logPath)) return 0
  const lines = readFileSync(logPath, 'utf-8').trim().split('\n')
  let total = 0
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line) as Partial<CostEntry>
      total += entry.cost_usd ?? 0
    } catch {
      // skip malformed lines
    }
  }
  return total
}

export async function checkCaps(
  totalOverride?: number,
  caps = { soft: DEFAULT_SOFT_CAP, hard: DEFAULT_HARD_CAP },
  logPath = DEFAULT_LOG,
): Promise<CostCheckResult> {
  const total = totalOverride ?? (await readTotal(logPath))
  if (total >= caps.hard) {
    return {
      ok: false,
      level: 'hard',
      total,
      message: `Build cost $${total.toFixed(2)} exceeded hard cap $${caps.hard}. Session aborted.`,
    }
  }
  if (total >= caps.soft) {
    return {
      ok: true,
      level: 'warn',
      total,
      message: `Build cost $${total.toFixed(2)} exceeded soft cap $${caps.soft}. Consider stopping soon.`,
    }
  }
  return {
    ok: true,
    level: 'ok',
    total,
    message: `Build cost $${total.toFixed(2)} within limits.`,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const total = await readTotal()
  const result = await checkCaps()
  process.stdout.write(`Total build cost: $${total.toFixed(4)}\n`)
  process.stdout.write(`Status: ${result.level.toUpperCase()} — ${result.message}\n`)
  if (!result.ok) process.exit(1)
}
