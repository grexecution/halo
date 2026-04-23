/**
 * DAY 4 — Proactivity + Goal Loop + Telegram (if available)
 * Goal: Does it take initiative? Do scheduled goals fire? Does Telegram sync work?
 */

import { test, chat, cpGet, cpPost, results, summarize, contains } from './shared.js'
import { appendFileSync } from 'fs'

const DAY = 4
const SESSION = `day4-${Date.now()}`
const TELEGRAM_TOKEN = process.env.HALO_TELEGRAM_TOKEN ?? ''
const TELEGRAM_CHAT_ID = process.env.HALO_TELEGRAM_CHAT_ID ?? ''

async function run() {
  console.log('🚀 Halo Live Test — Day 4: Proactivity + Goals + Telegram\n')

  // ── Goal loop: verify yesterday's goal fired ──────────────────────────────
  await test('F-007c', "Yesterday's cron goal appears in history/logs", async () => {
    const goals = (await cpGet('/api/goals')) as Array<Record<string, unknown>>
    const testGoal = goals.find((g) => String(g.name).includes('Day2 Test Goal'))
    const ok = !!testGoal
    return {
      ok,
      notes: `Found Day2 goal: ${ok ? JSON.stringify(testGoal).slice(0, 200) : 'NOT FOUND'}`,
      suggestion: ok
        ? undefined
        : 'Goal not persisted across server restart — check DB connection for goals table',
    }
  })

  await test('F-007d', 'Create a one-time goal and verify it queues', async () => {
    const goal = (await cpPost('/api/goals', {
      name: 'Day4 One-Time Goal',
      prompt: 'Reply with exactly: DAY4_GOAL_FIRED',
      schedule: 'once',
      runAt: new Date(Date.now() + 60_000).toISOString(), // 1 minute from now
      enabled: true,
    })) as Record<string, unknown>
    return { ok: !!goal.id, notes: `Goal ID: ${goal.id}` }
  })

  // ── Proactivity ──────────────────────────────────────────────────────────
  await test('F-021a', 'Agent notices task is incomplete and asks a follow-up', async () => {
    const reply = await chat('I want to automate something.', `${SESSION}-proactive`)
    // A proactive agent should ask what they want to automate, not just say "ok"
    const isProactive =
      reply.includes('?') ||
      contains(reply, 'what') ||
      contains(reply, 'which') ||
      contains(reply, 'tell me more')
    return {
      ok: isProactive,
      notes: `Reply: "${reply.slice(0, 200)}"`,
      suggestion: isProactive
        ? undefined
        : 'Agent not asking clarifying questions — may be too passive. Consider injecting proactivity instruction in system prompt.',
    }
  })

  await test(
    'F-021b',
    'Agent proactively suggests next action after completing a task',
    async () => {
      const s = `${SESSION}-suggest`
      const reply = await chat('I just set up a new PostgreSQL database for my project.', s)
      // Should suggest next steps: migrations, backups, connection pooling, etc.
      const suggestsNext =
        contains(reply, 'next') ||
        contains(reply, 'also') ||
        contains(reply, 'consider') ||
        contains(reply, 'would you like') ||
        contains(reply, 'suggest')
      return {
        ok: suggestsNext,
        notes: `Reply: "${reply.slice(0, 300)}"`,
      }
    },
  )

  // ── Model routing ─────────────────────────────────────────────────────────
  await test('F-018a', 'LiteLLM proxy health check', async () => {
    const res = await fetch('http://localhost:8000/health')
    return {
      ok: res.ok,
      notes: `LiteLLM HTTP ${res.status}`,
      suggestion: res.ok
        ? undefined
        : 'LiteLLM not running — model routing disabled. Start with docker compose -f docker/compose.yml up litellm',
    }
  })

  await test('F-018b', 'Agent routes complex task to best model (check logs)', async () => {
    const reply = await chat(
      'Solve this step by step: If a train leaves Chicago at 9am traveling at 80mph, and another train leaves New York at 11am traveling at 100mph, and the distance between the cities is 790 miles, at what time do they meet?',
      `${SESSION}-routing`,
    )
    const ok =
      reply.length > 100 &&
      (contains(reply, 'pm') || contains(reply, 'mile') || contains(reply, 'hour'))
    return {
      ok,
      notes: `Math reply: "${reply.slice(0, 300)}"`,
    }
  })

  // ── Telegram tests (optional — only runs if token is set) ─────────────────
  if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
    console.log('\n📱 Telegram token found — running Telegram tests\n')

    await test('F-020a', 'Telegram bot is running and connected', async () => {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`)
      const data = (await res.json()) as { ok: boolean; result?: { username?: string } }
      return {
        ok: data.ok,
        notes: `Bot: @${data.result?.username ?? 'unknown'}`,
      }
    })

    await test('F-020b', 'Dashboard SSE endpoint for Telegram sync is open', async () => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 3000)
      try {
        const res = await fetch(
          `${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/chat/sse`,
          { signal: controller.signal },
        )
        return { ok: res.ok, notes: `SSE endpoint HTTP ${res.status}` }
      } catch {
        return { ok: false, notes: 'SSE connection failed or timed out' }
      }
    })
  } else {
    console.log('\n⚠️  HALO_TELEGRAM_TOKEN not set — skipping Telegram tests\n')
    console.log('   Set HALO_TELEGRAM_TOKEN + HALO_TELEGRAM_CHAT_ID to enable them.\n')
  }

  // ── Canvas ───────────────────────────────────────────────────────────────
  await test('F-022a', 'Canvas API: create a session', async () => {
    const res = await fetch(`${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Day4 Test Canvas' }),
    })
    const ok = res.ok || res.status === 201
    return { ok, notes: `Canvas create HTTP ${res.status}` }
  })

  // ── User modeling accumulation ────────────────────────────────────────────
  await test('F-017b', 'User model accumulates preferences over multiple days', async () => {
    // Day 1: we stored pizza preference, Day 3: we stored no-bullets preference
    // On a new session, does it still know these?
    const reply = await chat(
      "I'm going to ask you a few things. First: tell me about a meal I might enjoy based on what you know about me.",
      `${SESSION}-usermodel`,
    )
    const remembersPizza =
      contains(reply, 'pizza') ||
      contains(reply, 'Italian') ||
      contains(reply, 'food you mentioned')
    return {
      ok: remembersPizza,
      notes: `Reply: "${reply.slice(0, 300)}"`,
      suggestion: remembersPizza
        ? undefined
        : 'User model not persisting preferences across days — check user-model.ts storage',
    }
  })

  // ── Summarize ─────────────────────────────────────────────────────────────
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
