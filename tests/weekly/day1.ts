/**
 * DAY 1 — Baseline
 * Goal: Does it boot? Can it chat? Does it remember anything within a session?
 * Run this the moment the server is deployed.
 */

import { test, chat, cpGet, results, summarize, contains, sleep } from './shared.js'
import { appendFileSync } from 'fs'

const DAY = 1
const SESSION = `day1-${Date.now()}`

async function run() {
  console.log('🚀 Halo Live Test — Day 1: Baseline\n')

  // ── Server health ────────────────────────────────────────────────────────
  await test('F-BOOT', 'Server boots and health check passes', async () => {
    const health = (await cpGet('/health')) as Record<string, unknown>
    return { ok: health.status === 'ok', notes: JSON.stringify(health) }
  })

  await test('F-DASH', 'Dashboard responds', async () => {
    const res = await fetch(process.env.HALO_BASE_URL ?? 'http://localhost:3000')
    return { ok: res.ok, notes: `HTTP ${res.status}` }
  })

  // ── Basic chat ──────────────────────────────────────────────────────────
  await test('F-001a', 'Agent replies to a greeting', async () => {
    const reply = await chat('Hello! Who are you?', SESSION)
    const ok = reply.length > 10
    return { ok, notes: `Reply: "${reply.slice(0, 120)}"` }
  })

  await test('F-001b', 'Agent replies coherently to a task', async () => {
    const reply = await chat('What is the capital of France?', SESSION)
    const ok = contains(reply, 'paris')
    return { ok, notes: `Reply: "${reply.slice(0, 120)}"` }
  })

  await test('F-001c', 'Agent handles multi-turn context (5 turns)', async () => {
    const s = `${SESSION}-multi`
    await chat('My name is TestUser and I like pizza.', s)
    await chat('What kind of music do you like?', s)
    await chat('I prefer jazz over classical.', s)
    await chat('Tell me something interesting about Italy.', s)
    const reply = await chat('What food did I say I like?', s)
    const ok = contains(reply, 'pizza')
    return {
      ok,
      notes: `After 5 turns, recalled: ${ok ? 'pizza ✓' : `WRONG — got: "${reply.slice(0, 80)}"`}`,
      suggestion: ok
        ? undefined
        : 'Context recall failing at 5 turns — check memory injection in system prompt',
    }
  })

  // ── Memory ───────────────────────────────────────────────────────────────
  await test('F-002a', 'Memory API endpoint responds', async () => {
    const data = (await cpGet('/api/memory')) as unknown[]
    return { ok: Array.isArray(data), notes: `${data.length} memory entries` }
  })

  await test('F-003a', 'Semantic search returns results', async () => {
    // First store something to search for
    await chat('I work as a software engineer and I love TypeScript.', `${SESSION}-mem`)
    await sleep(1000)
    const res = await fetch(
      `${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/memory/search?q=software+engineer`,
      {},
    )
    const ok = res.ok
    return { ok, notes: `Search HTTP ${res.status}` }
  })

  // ── Agents CRUD ──────────────────────────────────────────────────────────
  await test('F-004a', 'Agent list endpoint works', async () => {
    const agents = (await cpGet('/api/agents')) as unknown[]
    return { ok: Array.isArray(agents), notes: `${agents.length} agents found` }
  })

  await test('F-004b', 'Can create a new agent via API', async () => {
    const agent = await fetch(`${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Agent Day1',
        systemPrompt: 'You are a test agent. Reply only with "TEST OK".',
        model: 'claude-haiku-4-5-20251001',
      }),
    })
    const ok = agent.ok || agent.status === 201
    return { ok, notes: `Create agent HTTP ${agent.status}` }
  })

  // ── Settings ─────────────────────────────────────────────────────────────
  await test('F-SETTINGS', 'Settings API returns current config', async () => {
    const settings = (await cpGet('/api/settings')) as Record<string, unknown>
    const ok = typeof settings === 'object' && settings !== null
    return { ok, notes: `Settings keys: ${Object.keys(settings ?? {}).join(', ')}` }
  })

  // ── Cost dashboard ───────────────────────────────────────────────────────
  await test('F-013a', 'Cost stats endpoint returns data', async () => {
    const stats = (await cpGet('/api/cost-stats')) as Record<string, unknown>
    const ok = typeof stats === 'object'
    return { ok, notes: JSON.stringify(stats).slice(0, 200) }
  })

  // ── PWA ──────────────────────────────────────────────────────────────────
  await test('F-019a', 'PWA manifest.json is served', async () => {
    const res = await fetch(`${process.env.HALO_BASE_URL ?? 'http://localhost:3000'}/manifest.json`)
    const ok = res.ok && res.headers.get('content-type')?.includes('json')
    return { ok, notes: `Manifest HTTP ${res.status}` }
  })

  await test('F-019b', 'Service worker is served', async () => {
    const res = await fetch(`${process.env.HALO_BASE_URL ?? 'http://localhost:3000'}/sw.js`)
    return { ok: res.ok, notes: `SW HTTP ${res.status}` }
  })

  // ── Wrap up ───────────────────────────────────────────────────────────────
  const md = summarize(DAY, new Date().toISOString().slice(0, 10))
  appendFileSync('FINDINGS.md', md)
  console.log('\n📝 Results appended to FINDINGS.md')

  const failed = results.filter((r) => !r.passed).length
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
