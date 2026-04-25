<div align="center">

<br />

<img src="https://raw.githubusercontent.com/grexecution/halo/main/docs/assets/halo-banner.svg" width="80" height="80" alt="Halo" />

# Halo

**Your AI assistant for life.**

[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Node 22](https://img.shields.io/badge/Node-22_LTS-white.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-482_passing-white.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-white.svg)](#)

<br />

```
curl -fsSL https://raw.githubusercontent.com/grexecution/halo/main/install.sh -o install.sh && bash install.sh
```

_One command. Fresh Ubuntu. Public dashboard URL. Login screen. Done._

<br />

</div>

---

## The idea

Start using Halo today. Connect your Gmail. Your calendar. Your WhatsApp exports. Your Garmin data. Your Telegram history. Every chat you've ever had with an AI.

In one year you have a year of context. In ten years you have a decade. Ask it things like:

> _"How has my resting heart rate changed over the last 5 years?"_
> _"What did we decide about the Vienna office lease in March 2023?"_
> _"Which clients have I worked with most in Q3 over the past three years?"_
> _"What did I cook last Christmas?"_

This is the part that makes it different. Not a chatbot. Not a task runner. A system that accumulates context about your life and actually uses it.

The longer you use it, the smarter it gets — not because the model improves, but because **your data does**.

---

## What OpenClaw should have been

OpenClaw was the dream — a self-hosted AI agent that actually works. It crashed. It forgot things. It never shipped.

Halo fixes that. One command. Real memory that survives restarts. Autonomous goals that fire on a cron. Model routing that falls back gracefully. A dashboard accessible from your phone the moment install finishes. **Your data stays on your hardware.**

---

## The memory system

Halo has a three-tier memory architecture designed to hold 10–30 years of personal data at query speed:

### Tier 1 — Pinned facts (< 1ms)

Key-value store for things that never change. Your name. Your company. Your timezone. These get injected into every system prompt automatically.

### Tier 2 — Hybrid search (< 200ms at 100k+ memories)

Every memory is indexed with:

- **pgvector HNSW** — semantic cosine similarity (AllMiniL6V2, 384-dim)
- **PostgreSQL FTS** — BM25 full-text search with GIN index
- **Time decay** — recent memories rank higher (180-day half-life)

The hybrid score: `0.5 × semantic + 0.3 × BM25 + 0.2 × time_decay`

At 100k memories: T1 = 1ms, T2 = 12ms, T4 = 9ms (241 monthly HR buckets). All stress tests pass.

### Tier 3 — Health SQL aggregates (no vectors needed)

Heart rate, HRV, steps, sleep, VO2max — stored as time-series in `health_metrics`. Aggregated at query time with `DATE_TRUNC`. No embedding overhead. Exact answers.

### Memory consolidation

A daily background job finds near-duplicate memories (cosine > 0.95) and merges them, tracking the canonical record in `memory_consolidations`. Storage stays lean even as ingestion grows.

---

## Import everything

Halo can ingest memory from anywhere:

| Source             | Format                                 | How                           |
| ------------------ | -------------------------------------- | ----------------------------- |
| OpenAI ChatGPT     | `conversations.json` (official export) | Upload → `/api/memory/import` |
| Claude / Anthropic | `conversations.json` (official export) | Upload → `/api/memory/import` |
| Generic chat       | JSON or CSV                            | Upload → `/api/memory/import` |
| Gmail              | OAuth (coming)                         | Connectors page               |
| Google Calendar    | OAuth (coming)                         | Connectors page               |
| WhatsApp           | Exported `.txt` chat                   | Upload → `/api/memory/import` |
| Telegram           | JSON export                            | Upload → `/api/memory/import` |
| Garmin / Strava    | Health data sync                       | Connectors page               |
| ClickUp            | Task sync                              | Connectors page               |

All imports normalize to the same memory schema. Embeddings are queued and processed in the background — you don't wait for them.

---

## Export everything

Your data is yours. Export anytime:

```
GET /api/memory/export?format=json   # Full structured JSON
GET /api/memory/export?format=csv    # Flat CSV with all fields
GET /api/memory/export?source=email  # Filter by source
GET /api/memory/export?since=2024-01-01  # Filter by date
```

Each record includes: `source`, `type`, `content`, `tags`, `created_at`. Human-readable — no raw vectors. You can re-import into any future system.

---

## Plugin system

Halo is designed to be extended. Every connector, skill, and integration is a self-contained plugin:

```
services/plugins/
  feedbucket/       ← example: visual feedback tool
  booking-com/      ← example: travel booking
  google-maps/      ← example: navigation
  strava/           ← fitness sync
```

A plugin declares what it does, what OAuth it needs, what MCP tools it exposes. The control-plane auto-discovers and loads plugins at startup. Adding a new integration is:

1. Drop a folder in `services/plugins/`
2. Define `plugin.json` (name, description, tools, auth)
3. Implement the tool handlers
4. Restart

The plugin is now available to the agent forever — including when Halo upgrades itself.

**Example: Feedbucket**

You tell Halo: _"Connect to Feedbucket."_ Halo checks if a Feedbucket plugin exists. It does. It asks for your API key, stores it in the keychain, and makes these tools available in every future session:

- `feedbucket.list_projects` — get all projects
- `feedbucket.get_feedback` — pull feedback items with screenshots
- `feedbucket.create_item` — submit a feedback item

You never set it up again. The connection persists across restarts, upgrades, and re-installs (via keychain export).

---

## Reusable patterns

Halo learns what it's done before. When you ask it to book a trip:

1. It checks `SkillStore` — is there a travel-booking skill? What worked last time?
2. It uses persistent plugin connections: `booking.com`, `get-your-guide`, `google-maps`
3. It saves the successful tool sequence as a new skill
4. Next trip: it reuses the skill, skips the discovery phase, goes straight to results

This is the WordPress-plugin analogy: the base system is simple. Plugins add capabilities. Skills are the memory of what worked. Over time, Halo gets dramatically faster at things it's done before — not because of model improvements, but because of accumulated patterns.

---

## How Halo compares

| Capability            | OpenClaw       | Hermes       | **Halo**                                 |
| --------------------- | -------------- | ------------ | ---------------------------------------- |
| Install               | Manual Docker  | pip + config | One curl command                         |
| Lifetime memory       | None           | Single-layer | **3-tier: facts + hybrid + health SQL**  |
| Memory at scale       | Crashes        | Degrades     | **100k+ memories, < 200ms queries**      |
| Import history        | None           | None         | **OpenAI, Claude, WhatsApp, Telegram**   |
| Export data           | None           | None         | **JSON + CSV, filtered, human-readable** |
| Plugin system         | None           | None         | **Auto-discovered, keychain-stored**     |
| Self-improving skills | None           | ✓            | **SkillStore + SkillReflector**          |
| Model routing         | Hardcoded      | Single       | **LiteLLM — cost/capability/fallback**   |
| Code execution        | None           | Subprocess   | **Isolated Docker sandbox**              |
| Telegram              | None           | None         | **Bidirectional, real-time sync**        |
| Cron goals            | None           | None         | **BullMQ cron + stuck-detection**        |
| Token budgets         | None           | None         | **Hard stop, not a warning**             |
| Auth                  | None           | None         | **bcrypt + optional TOTP**               |
| OTA updates           | None           | None         | **One-click from dashboard**             |
| Dashboard             | Basic, crashes | None         | **Full Next.js 15 PWA**                  |

---

## Features — what's actually built

### Memory that works across restarts

Three independent layers, all backed by Postgres + pgvector. Episodic (raw turns), semantic (vector search), working (active context). Stress-tested at 100k+ memories, 241 monthly health buckets spanning 20 years.

### Import pipeline (real, not a stub)

`POST /api/memory/import` — multipart file upload. Accepts OpenAI `conversations.json`, Claude `conversations.json`, generic CSV/JSON. Parses, normalizes, inserts into memories table, queues embedding jobs. Dashboard import button wired and working.

### Export pipeline (real, not a stub)

`GET /api/memory/export` — streams all memories as JSON or CSV. Filtered by source, type, or date. No raw vectors — human-readable and re-importable.

### Plugin auto-discovery

Drop a plugin folder, restart, tools appear. The control-plane walks `services/plugins/` at startup and registers any plugin that has a valid `plugin.json`. Credentials stored in the OS keychain via `keytar`.

### Self-improving skills

The `SkillReflector` watches every agent run and writes winning patterns to `SkillStore`. Every skill is a markdown file — readable, editable, deletable from the dashboard.

### Personality + onboarding

Five questions on first run. Answers stored as your user profile and injected into every system prompt. The agent knows who you are across restarts.

### Model routing via LiteLLM

LiteLLM sidecar routes by cost, capability, and fallback chain. Cheap model for simple tasks, expensive for complex. Vision tasks go to Claude. Code tasks go to GPT-4o or local Ollama. Never hard-errors on a single provider going down.

### Per-session Docker sandboxes

Every `execute_code` call runs in a fresh Docker container. Isolated filesystem, auto-cleanup, configurable CPU/memory limits.

### Sub-agent orchestration

Complex tasks decompose: Delegate → Execute (parallel) → Critic (review) → Merge. Catches its own mistakes before you see them.

### Telegram ↔ Dashboard unified chat

Send on Telegram, see in dashboard. Reply in dashboard, sends on Telegram. Same agent, same memory, same session. Real-time SSE event bus.

### Cron goals with self-repair

Define a goal, set a schedule, it fires. Detects stuck loops (same action 3× with no progress), self-repairs with a different strategy, logs outcome to Postgres with an OTel span.

### Token + cost budgets (hard stop)

Every session has `maxTokens` and `maxCost`. When hit, the orchestrator aborts — hard stop, not a warning. Daily spend cap with soft warning at 40%.

### Permission system with panic button

YAML permission config, hot-reloaded. Every tool call routes through middleware — no bypass possible. URL whitelist mode. Panic button kills all in-flight tool calls instantly.

### Over-the-air updates

Settings → Updates → Check for Updates. One click. The dashboard streams git pull + docker restart progress live. No SSH after initial install.

---

## Install

### Requirements

- Ubuntu 22.04+ (or modern Linux / macOS)
- Nothing else — the installer handles Node, Docker, and everything

### One command

```bash
curl -fsSL https://raw.githubusercontent.com/grexecution/halo/main/install.sh -o install.sh && bash install.sh
```

The wizard asks 4 questions, pulls images, starts all services, provisions a Cloudflare Tunnel, and prints:

```
┌─────────────────────────────────────────────────────┐
│  Halo is running                                    │
│                                                     │
│  Dashboard: https://abc123.trycloudflare.com        │
│  Username:  admin                                   │
│  Password:  a3f9-d2c1-88ba                         │
│                                                     │
│  Open the URL and start chatting.                   │
└─────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Dashboard (Next.js 15)             │
│  Chat · Agents · Skills · Memory · Goals · Cost      │
│  Settings · Updates · Canvas · Logs · Connectors     │
│  Import · Export                                     │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / SSE
┌────────────────────▼─────────────────────────────────┐
│                 Control Plane (Fastify)               │
│  Mastra agent · Tool execution · Memory pipeline     │
│  SkillStore · SkillReflector · Heartbeat + cron      │
│  Import API · Export API · Plugin auto-discovery     │
└──┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Postgres   Redis     Browser    LiteLLM
+ pgvector  BullMQ   (Playwright) (model proxy)

Plugins (auto-discovered at startup):
  services/plugins/feedbucket/
  services/plugins/strava/
  services/plugins/[your-plugin]/
```

**Stack:** Node 22 · Next.js 15 · Fastify · Mastra · Vercel AI SDK v6 · Postgres 16 + pgvector · Redis · BullMQ · LiteLLM · assistant-ui · Playwright · Docker Compose · Cloudflare Tunnel

---

## Development

```bash
git clone https://github.com/grexecution/halo
cd halo
pnpm install
pnpm -w run docker:up
pnpm -w run dev

pnpm test                  # 482 tests
pnpm -w run typecheck      # 0 errors

# Seed lifetime memory data (50k memories + 20yr health metrics)
DATABASE_URL=postgresql://greg:greg@localhost:5432/greg \
  npx tsx scripts/seed-massive-history.ts

# Run stress tests T1-T7
DATABASE_URL=postgresql://greg:greg@localhost:5432/greg \
  npx tsx scripts/stress-test-memory.ts
```

```
apps/
  cli/            # curl | bash installer + wizard
  dashboard/      # Next.js frontend

services/
  control-plane/  # Fastify API + Mastra agent + memory pipeline
  plugins/        # Auto-discovered integrations
    feedbucket/
    strava/

packages/
  shared/         # Types, OTel, utilities
  memory/         # 3-layer memory
  messaging/      # Telegram (grammY)

scripts/
  seed-massive-history.ts   # Seeds 50k memories + 20yr health data
  stress-test-memory.ts     # T1-T7 benchmark suite
```

---

## Hetzner recommended spec

| Server | Price    | RAM   | Use case                               |
| ------ | -------- | ----- | -------------------------------------- |
| CX32   | €6.80/mo | 8 GB  | Standard — Anthropic/OpenAI API        |
| CX42   | €16/mo   | 16 GB | Local Ollama (llama3.1:8b, no API key) |

> CX32 + Anthropic API is the sweet spot. Full capability for under €10/month total.

---

## Roadmap

- [ ] Gmail OAuth ingest (real-time sync + backfill)
- [ ] Google Calendar sync
- [ ] Strava / Garmin direct API (replace manual export)
- [ ] Plugin marketplace — share plugins with others
- [ ] Named Cloudflare tunnels with custom domain
- [ ] Voice mode (Parakeet STT + Piper TTS — local, no API key)
- [ ] Multi-user mode with per-user agents and memory
- [ ] Mobile push notifications
- [ ] WhatsApp Business API integration
- [ ] Auto-update on schedule

---

## License

MIT — do whatever you want with it.

---

<div align="center">

Start using it today. Every day you don't, you're losing context you'll never get back.

**[Star on GitHub](https://github.com/grexecution/halo)** · **[Open an issue](https://github.com/grexecution/halo/issues)**

</div>
