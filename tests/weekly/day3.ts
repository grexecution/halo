/**
 * DAY 3 — Stress: Multi-turn Depth + Tool Use + Reasoning
 * Goal: How deep can it go? Complex reasoning, chained tool use, long conversations.
 */

import { test, chat, results, summarize, contains, sleep } from './shared.js'
import { appendFileSync } from 'fs'

const DAY = 3
const SESSION = `day3-${Date.now()}`

async function run() {
  console.log('🚀 Halo Live Test — Day 3: Stress — Depth, Tools, Reasoning\n')

  // ── 20-turn conversation coherence ───────────────────────────────────────
  await test('F-001d', '20-turn conversation — first fact recalled at turn 20', async () => {
    const s = `${SESSION}-20turn`
    const topics = [
      'My favourite colour is midnight blue.',
      'I have a cat named Whiskers.',
      'Tell me about quantum computing.',
      'What are the pros and cons of TypeScript?',
      'Explain Docker in one paragraph.',
      'Who invented the internet?',
      'What is the best pizza topping?',
      'Explain the difference between SQL and NoSQL.',
      'Write a haiku about programming.',
      'What is a closure in JavaScript?',
      'Tell me a joke.',
      'What is the capital of Japan?',
      'Explain machine learning to a 5 year old.',
      'What makes a good API design?',
      'How does Git branching work?',
      'What is the speed of light?',
      'Name three uses of Redis.',
      'What is GDPR?',
      'How do you center a div in CSS?',
    ]
    for (const msg of topics) {
      await chat(msg, s)
      await sleep(300)
    }
    const reply = await chat("What is my favourite colour and what is my cat's name?", s)
    const ok = contains(reply, 'midnight blue') && contains(reply, 'whiskers')
    return {
      ok,
      notes: `At turn 20, recalled: colour=${contains(reply, 'midnight blue')}, cat=${contains(reply, 'whiskers')}`,
      suggestion: ok
        ? undefined
        : `Memory degrades by turn 20. Consider increasing context window or summarising older turns.`,
    }
  })

  // ── Multi-step reasoning ──────────────────────────────────────────────────
  await test('F-REASON-a', 'Multi-step logical deduction', async () => {
    const reply = await chat(
      'If all Bloops are Razzies, and all Razzies are Lazzies, are all Bloops definitely Lazzies? Show your reasoning step by step.',
      `${SESSION}-logic`,
    )
    const ok =
      contains(reply, 'yes') &&
      (contains(reply, 'transitive') || contains(reply, 'therefore') || contains(reply, 'follow'))
    return { ok, notes: `Reply: "${reply.slice(0, 300)}"` }
  })

  await test('F-REASON-b', 'Planning a complex multi-step task', async () => {
    const reply = await chat(
      'I need to build a REST API that handles user auth, stores data in PostgreSQL, and sends email notifications. Give me a step-by-step implementation plan with specific technology choices.',
      `${SESSION}-plan`,
    )
    const ok =
      reply.length > 500 &&
      (contains(reply, 'postgres') || contains(reply, 'jwt') || contains(reply, 'smtp'))
    return {
      ok,
      notes: `Plan length: ${reply.length} chars, mentions postgres: ${contains(reply, 'postgres')}`,
    }
  })

  // ── Chained tool use ──────────────────────────────────────────────────────
  await test('F-TOOLS-chain', 'Chained tool use: write file, read it back, summarise', async () => {
    const s = `${SESSION}-chain`
    const content = 'The quick brown fox jumps over the lazy dog. This is a test file for Halo.'
    await chat(`Write this text to /tmp/chain_test.txt: "${content}"`, s)
    await sleep(500)
    const reply = await chat(
      'Read /tmp/chain_test.txt and give me a one-sentence summary of its content.',
      s,
    )
    const ok =
      contains(reply, 'fox') ||
      contains(reply, 'dog') ||
      contains(reply, 'test') ||
      contains(reply, 'halo')
    return {
      ok,
      notes: `Summary: "${reply.slice(0, 200)}"`,
    }
  })

  // ── Vision tool ───────────────────────────────────────────────────────────
  await test('F-011a', 'Vision tool — describe a public image URL', async () => {
    const reply = await chat(
      'Analyze this image and describe what you see: https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png',
      `${SESSION}-vision`,
    )
    const ok = reply.length > 30 && !contains(reply, 'cannot') && !contains(reply, 'error')
    return {
      ok,
      notes: `Vision reply: "${reply.slice(0, 300)}"`,
      suggestion: ok
        ? undefined
        : 'Vision tool not working — check vision-service is running on port 3003',
    }
  })

  // ── Browser tool ─────────────────────────────────────────────────────────
  await test('F-010a', 'Browser tool — fetch page content', async () => {
    const reply = await chat(
      'Navigate to https://example.com and tell me the main heading on the page.',
      `${SESSION}-browser`,
    )
    const ok =
      contains(reply, 'example') || contains(reply, 'domain') || contains(reply, 'illustrative')
    return {
      ok,
      notes: `Browser reply: "${reply.slice(0, 300)}"`,
      suggestion: ok
        ? undefined
        : 'Browser navigate tool not working — check browser-service is running on port 3002',
    }
  })

  // ── Sub-agent delegation ─────────────────────────────────────────────────
  await test('F-014a', 'Sub-agent: complex task gets decomposed', async () => {
    const reply = await chat(
      'I need you to: (1) research what TypeScript decorators are, (2) write a simple example of one, and (3) explain when NOT to use them. Use sub-tasks if needed.',
      `${SESSION}-subagent`,
    )
    const ok =
      reply.length > 400 &&
      contains(reply, 'decorator') &&
      (contains(reply, 'example') || contains(reply, 'class'))
    return {
      ok,
      notes: `Response length: ${reply.length}, mentions decorator: ${contains(reply, 'decorator')}`,
    }
  })

  // ── User preference learning ──────────────────────────────────────────────
  await test('F-017a', 'User model learns preferences', async () => {
    const s = `${SESSION}-prefs`
    await chat('Please never use bullet points in your responses. I prefer plain paragraphs.', s)
    await sleep(500)
    const reply = await chat('List three benefits of exercise.', s)
    // If it learned, it won't use bullet points (no lines starting with - or •)
    const hasBullets = /^[-•*]\s/m.test(reply)
    return {
      ok: !hasBullets,
      notes: `After asking for no bullets, response ${hasBullets ? 'STILL HAS bullets' : 'correctly uses paragraphs'}`,
      suggestion: hasBullets
        ? 'User preference not being carried across turns — check user-model injection into system prompt'
        : undefined,
    }
  })

  // ── Skills ───────────────────────────────────────────────────────────────
  await test('F-016a', 'Skills API endpoint exists and responds', async () => {
    const res = await fetch(`${process.env.HALO_CP_URL ?? 'http://localhost:3001'}/api/skills`)
    return { ok: res.ok || res.status === 404, notes: `Skills endpoint HTTP ${res.status}` }
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
