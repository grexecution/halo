# open-greg — Project Overview

> _Self-hosted, autonomous AI agent platform. Zero Docker knowledge required. One npm install._

---

## What it is

**open-greg** is an open-source replacement for OpenClaw — an AI agent host you run on your own machine (Mac Mini, Linux box). It fixes OpenClaw's core failures: no real memory, no granular permissions, crashes without recovery, sub-agents that behave oddly.

The design philosophy: every hard problem is already solved by a well-maintained library. open-greg glues them together with a clean permission model on top.

**Target user:** one technical person — developer, agency owner, power user — running it for themselves.

---

## What it does

| Capability          | How                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------- |
| Chat with AI agents | Dashboard chat UI, Telegram, Discord, Slack, email                                      |
| Persistent memory   | Mem0 OpenMemory — indexes every chat, tool call, email, file read                       |
| Computer control    | Shell, filesystem, desktop GUI (Anthropic computer-use), browser (3 modes)              |
| Autonomous work     | Cron jobs, goal loops, self-critique via critic sub-agent                               |
| Voice               | Parakeet STT + Piper TTS (local), Deepgram + ElevenLabs (cloud)                         |
| Connectors          | Gmail, GitHub, Google Calendar, Notion, Linear, HubSpot, Atlassian, Slack — all via MCP |
| Local LLMs          | Ollama (3 tiers: 3B / 14B / 32–70B)                                                     |
| Permissions         | Per-tool, per-path, per-URL — YAML config, hot-reloaded, never bypassable               |

---

## How it installs

```bash
npx create-open-greg init
```

The CLI wizard (~10 min) asks for LLM provider, local model tier, messaging platforms, MCP connectors, and filesystem permissions. It writes config, starts Docker Compose in the background, and opens the dashboard. The user never types `docker`.

---

## Project status

In **spec phase**. All architecture, feature registry, build phases, and test scaffolding are defined. Code scaffolding is driven by `BUILD_PROMPT.md`. See `docs/PHASES.md` for the 7-phase roadmap.

---

## Where things live

```
open-greg/
├── AGENTS.md               # AI agent entry point (also CLAUDE.md symlink)
├── BUILD_PROMPT.md         # master prompt to autopilot the full build
├── README.md               # human-facing overview
├── docs/
│   ├── ARCHITECTURE.md     # full system design
│   ├── FEATURES.md         # feature registry (F-001 … F-169)
│   ├── PHASES.md           # 7-phase build plan
│   ├── CONVENTIONS.md      # code style rules
│   ├── PERMISSIONS.md      # security model
│   ├── DATA_MODEL.md       # DB schema
│   ├── CONNECTORS.md       # MCP / LLM / external service wiring
│   ├── AGENTS_INTERNAL.md  # orchestrator internals
│   ├── TESTING.md          # test philosophy and feature-test runner
│   ├── SELF_REPAIR.md      # bounded-iteration rules
│   ├── RUNBOOK.md          # known failure modes + recovery
│   └── OPEN_DECISIONS.md   # unresolved design questions
├── apps/
│   ├── cli/                # npx create-open-greg package
│   └── dashboard/          # Next.js 15 dashboard
├── services/
│   ├── control-plane/      # Fastify + tRPC orchestrator
│   ├── browser-service/    # Playwright pool
│   ├── voice-service/      # STT/TTS (Python)
│   ├── vision-service/     # OCR + VLM (Python)
│   └── watchdog/           # health checker + restarter
├── packages/
│   ├── shared/             # zod schemas, OTel wrappers, shared types
│   ├── agent-core/         # AgentOrchestrator + sub-agent base
│   ├── permissions/        # PermissionMiddleware + YAML loader
│   ├── memory/             # Mem0 client abstraction
│   ├── connectors/         # MCP registry + OAuth flows
│   ├── tools/              # native tool implementations
│   └── telemetry/          # OpenTelemetry instrumentation
└── docker/
    └── compose.yml         # Postgres, Redis, Ollama, Mem0, Qdrant
```

---

## Golden rules (short version)

1. Every tool call routes through `PermissionMiddleware.check()` — no exceptions.
2. State lives in Postgres. In-process state does not survive restarts.
3. No plaintext secrets on disk — OS keychain via `keytar`.
4. Every feature in `docs/FEATURES.md` has an automated test before it's `done`.
5. Max 5 iterations on a failing test; on failure write `STUCK.md` and stop.

Full rules: `AGENTS.md` section 3.

---

## Stack at a glance

| Layer         | Choice                                                          |
| ------------- | --------------------------------------------------------------- |
| Runtime       | Node 22 LTS, pnpm workspaces                                    |
| API           | Fastify + tRPC                                                  |
| Frontend      | Next.js 15, shadcn/ui, Tailwind, assistant-ui                   |
| DB            | Postgres 16 + pgvector                                          |
| Queue         | BullMQ on Redis                                                 |
| Agent SDK     | Vercel AI SDK v6 + `@ai-sdk/mcp`                                |
| Memory        | Mem0 OpenMemory (default), Hindsight (swappable)                |
| Browser       | Playwright (3 modes)                                            |
| Local LLM     | Ollama                                                          |
| Secrets       | OS keychain (`keytar`), AES-256 file fallback on headless Linux |
| Observability | OpenTelemetry → SigNoz (optional)                               |

_End of PROJECT_OVERVIEW.md_
