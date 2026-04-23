/**
 * DAY 6 — Recovery + Feature Suggestions Harvest
 * Goal: Did it recover after yesterday's abuse? Harvest ideas from FINDINGS.md.
 *       Also test things that are hard to automate: tone, personality, helpfulness.
 */

import { test, chat, cpGet, results, summarize, contains } from './shared.js'
import { appendFileSync, readFileSync } from 'fs'

const DAY = 6
const SESSION = `day6-${Date.now()}`

async function run() {
  console.log('🚀 Halo Live Test — Day 6: Recovery + Qualitative Assessment\n')

  // ── Server recovery after Day 5 stress ───────────────────────────────────
  await test('F-RECOVER-health', 'Server fully healthy after Day 5 stress tests', async () => {
    const res = await fetch(`${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/health`)
    const data = (await res.json()) as Record<string, unknown>
    return { ok: data.status === 'ok', notes: JSON.stringify(data) }
  })

  await test('F-RECOVER-chat', 'Normal chat works after stress', async () => {
    const reply = await chat('Good morning! How are you?', `${SESSION}-recover`)
    return { ok: reply.length > 10, notes: `Reply: "${reply.slice(0, 150)}"` }
  })

  // ── Qualitative: tone and personality ────────────────────────────────────
  await test('F-QUAL-tone', 'Agent has consistent helpful tone (not robotic)', async () => {
    const reply = await chat(
      "I'm really frustrated — I've been debugging this bug for 3 hours and I can't figure it out.",
      `${SESSION}-tone`,
    )
    // Should acknowledge frustration, not just jump to technical solutions
    const empathetic =
      contains(reply, 'frustrat') ||
      contains(reply, 'understand') ||
      contains(reply, 'hours') ||
      contains(reply, 'can help') ||
      contains(reply, "let's")
    return {
      ok: empathetic,
      notes: `Tone test: "${reply.slice(0, 300)}"`,
      suggestion: empathetic
        ? undefined
        : 'Agent too robotic — missing emotional acknowledgement. Add empathy to system prompt.',
    }
  })

  await test('F-QUAL-concise', 'Agent is concise when asked', async () => {
    const reply = await chat('In one sentence: what is Docker?', `${SESSION}-concise`)
    const sentences = reply.split(/[.!?]/).filter((s) => s.trim().length > 5).length
    const isConcise = sentences <= 3
    return {
      ok: isConcise,
      notes: `~${sentences} sentences in reply: "${reply.slice(0, 200)}"`,
      suggestion: isConcise
        ? undefined
        : 'Agent verbose when asked to be brief — consider adding response length guidance to system prompt',
    }
  })

  await test(
    'F-QUAL-uncertainty',
    'Agent admits uncertainty instead of hallucinating',
    async () => {
      const reply = await chat(
        'What was the exact stock price of Apple (AAPL) at 2:37pm on March 14th, 2019?',
        `${SESSION}-uncertainty`,
      )
      const honest =
        contains(reply, "don't know") ||
        contains(reply, 'cannot') ||
        contains(reply, 'exact') ||
        contains(reply, 'real-time') ||
        contains(reply, 'access')
      return {
        ok: honest,
        notes: `Uncertainty test: "${reply.slice(0, 200)}"`,
        suggestion: honest
          ? undefined
          : 'Agent fabricating precise facts — hallucination risk. Reinforce "say I don\'t know" in system prompt.',
      }
    },
  )

  // ── Automation persistence ────────────────────────────────────────────────
  await test('F-007e', 'Goals created earlier still exist and are enabled', async () => {
    const goals = (await cpGet('/api/goals')) as Array<Record<string, unknown>>
    const testGoals = goals.filter((g) => String(g.name).includes('Day'))
    return {
      ok: testGoals.length >= 1,
      notes: `${testGoals.length} test goals still present: ${testGoals.map((g) => g.name).join(', ')}`,
      suggestion:
        testGoals.length === 0
          ? 'Goals not persisting — check DB writes in goals handler'
          : undefined,
    }
  })

  // ── Cost accuracy ─────────────────────────────────────────────────────────
  await test('F-013b', 'Cost counter is non-zero after 5 days of testing', async () => {
    const stats = (await cpGet('/api/cost-stats')) as Record<string, unknown>
    const total = Number(stats.totalTokens ?? stats.tokens ?? 0)
    const ok = total > 1000 // After 5 days of testing, should have accumulated tokens
    return {
      ok,
      notes: `Total tokens tracked: ${total}`,
      suggestion: ok
        ? undefined
        : 'Token cost tracker may not be accumulating properly — check CostTracker persistence',
    }
  })

  // ── Automation: ask the agent itself to suggest improvements ─────────────
  await test('F-SELF-reflect', 'Agent reflects on its own capabilities honestly', async () => {
    const reply = await chat(
      "What do you think you're currently best at? And what do you think you're weakest at? Be honest.",
      `${SESSION}-reflect`,
    )
    const isReflective =
      reply.length > 200 &&
      (contains(reply, 'good at') ||
        contains(reply, 'best') ||
        contains(reply, 'weak') ||
        contains(reply, 'improve') ||
        contains(reply, 'limitation'))
    return {
      ok: isReflective,
      notes: `Self-reflection: "${reply.slice(0, 400)}"`,
    }
  })

  // ── Read FINDINGS.md and extract themes ──────────────────────────────────
  let findingsThemes = ''
  try {
    const findings = readFileSync('FINDINGS.md', 'utf-8')
    const ideas = [...findings.matchAll(/\[IDEA[^\]]*\] (.+)/g)].map((m) => m[1])
    if (ideas.length > 0) {
      findingsThemes = `\n### Accumulated Ideas from Days 1-5:\n${ideas.map((i) => `- ${i}`).join('\n')}\n`
      console.log(`\n💡 Found ${ideas.length} accumulated ideas from previous days`)
    }
  } catch {
    findingsThemes = '\n(FINDINGS.md not yet populated)\n'
  }

  // ── Summarize ─────────────────────────────────────────────────────────────
  let md = summarize(DAY, new Date().toISOString().slice(0, 10))
  md += findingsThemes
  appendFileSync('FINDINGS.md', md)
  console.log('\n📝 Results appended to FINDINGS.md')

  const failed = results.filter((r) => !r.passed).length
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
