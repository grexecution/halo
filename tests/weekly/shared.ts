/**
 * Shared utilities for Halo weekly live testing scripts.
 * These run against a DEPLOYED server, not localhost vitest.
 */

export const BASE_URL = process.env.HALO_BASE_URL ?? 'http://localhost:3000'
export const CP_URL = process.env.HALO_CP_URL ?? 'http://localhost:3001'
export const API_KEY = process.env.HALO_API_KEY ?? ''
export const TELEGRAM_TOKEN = process.env.HALO_TELEGRAM_TOKEN ?? ''

export interface TestResult {
  feature: string
  featureId: string
  passed: boolean
  notes: string
  durationMs: number
  suggestion?: string
}

export const results: TestResult[] = []

export async function test(
  featureId: string,
  feature: string,
  fn: () => Promise<{ ok: boolean; notes: string; suggestion?: string }>,
): Promise<void> {
  const start = Date.now()
  try {
    const { ok, notes, suggestion } = await fn()
    results.push({
      feature,
      featureId,
      passed: ok,
      notes,
      durationMs: Date.now() - start,
      suggestion,
    })
    const icon = ok ? '✅' : '❌'
    console.log(`${icon} [${featureId}] ${feature}`)
    if (notes) console.log(`   ${notes}`)
    if (suggestion) console.log(`   💡 ${suggestion}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    results.push({
      feature,
      featureId,
      passed: false,
      notes: `THREW: ${msg}`,
      durationMs: Date.now() - start,
    })
    console.log(`❌ [${featureId}] ${feature}`)
    console.log(`   THREW: ${msg}`)
  }
}

/** POST to control-plane /api/chat and return the agent reply text */
export async function chat(message: string, sessionId = 'test-session'): Promise<string> {
  const res = await fetch(`${CP_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
  if (!res.ok) throw new Error(`chat HTTP ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { reply?: string; message?: string }
  return json.reply ?? json.message ?? ''
}

/** GET any control-plane endpoint */
export async function cpGet(path: string): Promise<unknown> {
  const res = await fetch(`${CP_URL}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`)
  return res.json()
}

/** POST any control-plane endpoint */
export async function cpPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${CP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Sleep for N ms */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Assert string contains substring */
export function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/** Print summary and return markdown block for FINDINGS.md */
export function summarize(run: number, date: string): string {
  const passed = results.filter((r) => r.passed).length
  const total = results.length
  const failed = results.filter((r) => !r.passed)
  const suggestions = results.filter((r) => r.suggestion)

  console.log('\n' + '='.repeat(60))
  console.log(`Run ${run} (${date}): ${passed}/${total} passed`)
  console.log('='.repeat(60))

  const lines: string[] = [
    `## Run ${run} — ${date}`,
    ``,
    `### Passed: ${passed}/${total} features`,
    ``,
  ]

  if (failed.length > 0) {
    lines.push(`### Issues Found:`)
    for (const r of failed) {
      lines.push(`- **[${r.featureId}] ${r.feature}**: ${r.notes}`)
    }
    lines.push('')
  }

  if (suggestions.length > 0) {
    lines.push(`### Feature Suggestions:`)
    for (const r of suggestions) {
      lines.push(`- [IDEA from ${r.featureId}] ${r.suggestion}`)
    }
    lines.push('')
  }

  lines.push('### Timings:')
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    lines.push(`- ${icon} [${r.featureId}] ${r.feature}: ${r.durationMs}ms`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  return lines.join('\n')
}
