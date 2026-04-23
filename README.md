<div align="center">

<br />

<img src="https://raw.githubusercontent.com/grexecution/halo/main/docs/assets/halo-banner.svg" width="80" height="80" alt="Halo" />

# Halo

**What OpenClaw should have been.**

[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Node 22](https://img.shields.io/badge/Node-22_LTS-white.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-441_passing-white.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-white.svg)](#)

<br />

```
npx create-halo
```

_One command. Fresh Ubuntu. Public dashboard URL. Login screen. Done._

<br />

</div>

---

## What is Halo?

OpenClaw was the dream — a self-hosted AI agent that actually works. It crashed. It forgot things. It never shipped.

Hermes got close — persistent memory, a self-improvement loop, production-ready. But it's complex to deploy, opinionated about your stack, and still doesn't give you a clean dashboard you can hand to a non-technical person.

Halo is the fix. One command on a cheap server. Real 3-layer memory that survives restarts. Autonomous goals that fire on a cron. Model routing that falls back gracefully. A dashboard accessible from your phone the moment install finishes. Your data stays on your hardware.

---

## How Halo compares

| Capability | OpenClaw | Hermes | **Halo** |
|---|---|---|---|
| Install | Manual Docker setup | pip + config files | `npx create-halo` — wizard, done |
| Public URL | None | None | Cloudflare Tunnel auto-provisioned |
| Dashboard | Basic, crashes | None (CLI only) | Full Next.js 15 app, PWA, login |
| Memory | Session-only, lost on restart | Persistent (single-layer) | **3-layer: episodic + semantic (pgvector) + working context** |
| Self-improvement | None | ✓ learning loop | **SkillStore + SkillReflector — generates and rates its own tools** |
| User modeling | None | None | **Honcho-style: learns preferences, goals, constraints per user** |
| Model routing | Single model hardcoded | Single model | **LiteLLM proxy — routes by cost/capability, fallback chain** |
| Code execution | None | Subprocess (no isolation) | **Isolated Docker sandbox per session — no shared state** |
| Sub-agents | None | None | **Delegate + Critic pattern — decomposes tasks, reviews output** |
| Telegram | None | None | **Bidirectional — send from Telegram, see in dashboard (and vice versa)** |
| Cron goals | None | None | **Cron-scheduled goal loop with stuck-detection + self-repair** |
| Token budgets | None | None | **Hard stop per session — enforced in orchestrator, not just warned** |
| Canvas | None | None | **Real-time collaborative whiteboard with DB persistence** |
| Observability | None | Basic logs | **OpenTelemetry spans on every agent run** |
| Auth | None | None | **Session cookies + optional TOTP, force-change on first login** |
| Local LLM | None | Ollama optional | **Ollama built in — llama3.2:3b runs on CX32 (€6.80/mo)** |

---

## Features — what's actually built

### Memory that works across restarts

Three independent layers, all backed by Postgres + pgvector:

- **Episodic** — raw message history. Every turn stored, indexed, retrievable.
- **Semantic** — vector embeddings. "What did we talk about last week re: deployment?" returns the right chunk.
- **Working** — active context window. Managed automatically, never blows the token limit.

Export to vault (markdown files) anytime as an escape hatch. OpenClaw had none of this. Hermes has single-layer persistence — no vector search, no working memory management.

### Self-improving skills

The `SkillReflector` watches every agent run. When a tool sequence succeeds (≥1 tool call, configurable), it scores the approach and writes a new skill to `SkillStore`. Next time a similar task comes in, Halo reuses the winning pattern instead of rediscovering it.

Hermes has a learning loop but it's black-box. Halo's is inspectable — every skill is a named record you can read, edit, or delete from the dashboard. OpenClaw had no skill system at all.

### Model routing via LiteLLM

A LiteLLM sidecar runs at `localhost:8000`, OpenAI-compatible. Halo routes to it with:

- **Cost routing** — cheap model for simple tasks, expensive model for complex ones
- **Capability routing** — vision tasks go to Claude, code tasks go to GPT-4o or local Ollama
- **Fallback chain** — if Anthropic is down or over budget, falls back to OpenAI, then Ollama

Neither OpenClaw nor Hermes have model routing. Halo never hard-errors on a single provider going down.

### Per-session Docker sandboxes

Every `execute_code` call runs in a fresh Docker container — isolated filesystem, isolated process namespace, auto-cleanup on session end, configurable CPU/memory limits. Hermes runs code as a subprocess with no isolation. OpenClaw doesn't run code at all.

### Sub-agent orchestration

Complex tasks decompose automatically:

1. **Delegate** — spawns specialist sub-agents per subtask
2. **Execute** — sub-agents run in parallel with their own tool access
3. **Critic** — a reviewer agent checks output quality before returning results
4. **Merge** — results combined, deduplicated, summarised

Neither OpenClaw nor Hermes have a critic/review pass. Halo catches its own mistakes before you see them.

### Telegram ↔ Dashboard unified chat

Send a message on Telegram — it appears in the dashboard. Reply in the dashboard — it sends on Telegram. Same agent, same memory, same session. The chat event bus syncs in real time via SSE. OpenClaw and Hermes have no Telegram integration.

### Cron goals with self-repair

Define a goal: _"Every day at 08:00, check if my website returns 200. If not, message me on Telegram."_

Halo fires on schedule (BullMQ + cron), executes with full tool access, detects stuck loops (same action 3× with no progress), self-repairs with a different strategy, and logs outcome to Postgres with an OTel span. Set and forget.

### Token + cost budgets (hard stop)

Every session has a `maxTokens` and `maxCost` setting. When hit, the orchestrator aborts — not a warning, a hard stop. Enforced in the agent loop, not after the fact. Useful for autonomous overnight runs or Telegram bots you don't want racking up surprise bills.

### Live Canvas

Real-time collaborative whiteboard. Sessions persist to Postgres. Broadcast updates via WebSocket. Share a canvas link with anyone on your dashboard.

---

## Install

### Requirements

- Ubuntu 22.04+ (or any modern Linux / macOS)
- Nothing else — the installer handles Node, Docker, and everything

### One command

```bash
curl -fsSL https://raw.githubusercontent.com/grexecution/halo/main/install.sh | bash
```

That's it. The script installs Node 22 and Docker if missing, clones the repo, and launches the setup wizard. Total time on a fresh Hetzner CX32: under 3 minutes.

The wizard then asks 4 questions:

```
◆  Halo — self-hosted AI agent
│
◇  How do you want to access the dashboard?
│  ● Public URL (Cloudflare Tunnel — free, no account needed)
│  ○ Local only (localhost:3000)
│
◇  Which LLM do you want to use?
│  ● Anthropic Claude (recommended)
│  ○ OpenAI GPT
│  ○ Local Ollama (free, no API key)
│
◇  Anthropic API key:
│  sk-ant-...
│
◇  Dashboard password (or press Enter for a generated one):
│  ████████
│
◇  Ready to start. Pull images and launch? (~1–3 min)
│  Yes
```

Then it pulls Docker images, starts all services, provisions a Cloudflare Tunnel, and bootstraps your login. And prints:

```
┌─────────────────────────────────────────────────────┐
│  Halo is running                                    │
│                                                     │
│  Dashboard: https://abc123.trycloudflare.com        │
│  Username:  admin                                   │
│  Password:  a3f9-d2c1-88ba                         │
│                                                     │
│  Open the URL and start chatting.                   │
│  Keep this terminal open to maintain the public URL.│
└─────────────────────────────────────────────────────┘
```

Open the URL on any device. You're in.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Dashboard (Next.js 15)             │
│  Chat · Agents · Memory · Goals · Cost · Settings    │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / SSE
┌────────────────────▼─────────────────────────────────┐
│                 Control Plane (Fastify)               │
│  Mastra agent · Tool execution · Memory · Budget      │
└──┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Postgres   Redis     Browser    Vision
+ pgvector  BullMQ   (Playwright) (Claude API)
```

**Stack:** Node 22 · Next.js 15 · Fastify · Mastra · Vercel AI SDK v6 · Postgres 16 + pgvector · Redis · BullMQ · LiteLLM · Playwright · Docker Compose · Cloudflare Tunnel

Full architecture docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Hetzner recommended spec

| Server | Price | RAM | Use case |
|---|---|---|---|
| CX32 | €6.80/mo | 8 GB | Standard — Anthropic/OpenAI API |
| CX42 | €16/mo | 16 GB | Local Ollama (llama3.1:8b, no API key needed) |

> CX32 + Anthropic API is the sweet spot. Full capability for under €10/month total.

---

## Development

```bash
git clone https://github.com/grexecution/halo
cd halo
pnpm install
pnpm -w run docker:up
pnpm -w run dev

pnpm test                  # 441 tests
pnpm -w run typecheck      # 0 errors

# Run the live daily test suite against a deployed instance
HALO_BASE_URL=http://your-server:3000 \
HALO_CP_URL=http://your-server:3001 \
npx tsx tests/weekly/runner.ts
```

```
apps/
  cli/            # npx create-halo installer
  dashboard/      # Next.js frontend

services/
  control-plane/  # Fastify API + Mastra agent
  browser-service/
  voice-service/
  vision-service/

packages/
  shared/         # Types, OTel, utilities
  memory/
  messaging/      # Telegram (grammY)
```

---

## Roadmap

- [ ] Named Cloudflare tunnels with custom domain (e.g. `halo.yourdomain.com`)
- [ ] Voice mode (Parakeet STT + Piper TTS — local, no API key)
- [ ] Mobile push notifications
- [ ] Multi-user mode with per-user agents
- [ ] Plugin marketplace

---

## License

MIT — do whatever you want with it.

---

<div align="center">

Built with too much coffee and a genuine belief that AI agents should run on your hardware, not someone else's.

**[Star on GitHub](https://github.com/grexecution/halo)** if this is useful to you.

</div>
