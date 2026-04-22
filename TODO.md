# TODO — open-greg Build Tracker

> _Status snapshot of the 7-phase build. Update this as phases complete. Detailed phase specs live in `docs/PHASES.md`. Feature statuses are the source of truth in `docs/FEATURES.md`._
>
> All features are currently marked `done` in `docs/FEATURES.md` — meaning the spec is written and the test path is defined. The checkboxes below track whether code + passing tests actually exist.

---

## Phase 1 — Skeleton & install story

**Goal:** `npx create-open-greg init` → blank dashboard on localhost.

- [ ] pnpm monorepo scaffolded with all workspaces (`apps/cli`, `apps/dashboard`, `services/control-plane`, `packages/shared`)
- [ ] TypeScript configs, ESLint (including `no-bypass-permission` rule stub), Prettier
- [ ] `apps/cli` — Ink/clack TUI: clone, install, generate passphrase, `docker compose up -d`, print URL
- [ ] `docker/compose.yml` — Postgres, Redis, Ollama. Every service has `HEALTHCHECK` + `restart: unless-stopped`
- [ ] `apps/dashboard` — Next.js 15 scaffold, Tailwind, shadcn/ui, one empty page
- [ ] `services/control-plane` — Fastify skeleton, `/health`, tRPC router stub
- [ ] `packages/shared/secrets.ts` — keytar with AES-GCM fallback
- [ ] `.env.example` in every service
- [ ] Pre-commit hooks: husky + lint-staged + gitleaks (F-166)
- [ ] Feature-test CI enforcement GitHub Action (F-160)
- [ ] STUCK.md escalation CI check (F-161)
- [ ] Cost tracking per build session (F-169)
- [ ] Fail-fast rescue branch logic (F-168)
- [ ] CI matrix: ubuntu x86_64, ubuntu arm64, macos-14

**Phase gate:** `pnpm test:features` reports F-001, F-002, F-004, F-120, F-135 green on all 3 platforms.

---

## Phase 2 — Core chat loop, memory, base permissions

**Goal:** chat with a single Claude-backed agent. Messages persist. Memory indexed. Basic permissions.

- [ ] `packages/shared` — zod schemas for Message, Agent, ToolCall, Permission + OTel wrapper
- [ ] `packages/agent-core` — AgentOrchestrator, `runTurn()` using Vercel AI SDK v6
- [ ] `packages/permissions` — YAML loader with hot-reload (chokidar), `check()` function, ESLint rule
- [ ] `packages/memory` — Mem0 OpenMemory client: `index()` and `search()`
- [ ] `packages/tools` — trivial `get_time` tool (through middleware)
- [ ] `services/control-plane` — tRPC routers: `agents.*`, `messages.*`, `memory.*`, `settings.*` + SSE streaming
- [ ] `packages/telemetry` — OTel setup, pino structured logging, secret redaction
- [ ] Drizzle schema + migrations for: agents, messages, memories, tool_calls, permissions
- [ ] `apps/dashboard` — chat, agents, memory, settings, logs pages
- [ ] `docker/compose.yml` — add Mem0 OpenMemory + Qdrant
- [ ] Wizard writes default "Claw" agent
- [ ] Per-session budget enforcement (F-130)
- [ ] Daily spend cap (F-131)
- [ ] Tool timeouts (F-134)
- [ ] Pino secret redaction (F-136)
- [ ] Regression detection infrastructure (F-162)
- [ ] Nightly regression build (F-163)
- [ ] Build-health dashboard page `/build-health` (F-164)
- [ ] Bounded auto-retry for flaky tests (F-165)
- [ ] Timezone in agent prompts (F-150)

**Phase gate:** send message → streamed response → restart control plane → conversation resumes with context.

---

## Phase 3 — Sub-agents, connectors, messaging

**Goal:** sub-agents, Gmail/GitHub/Calendar, Telegram/Discord/Slack, registry page.

- [ ] Extend AgentOrchestrator: handle `@mentions`, `delegate` tool, nested sessions (max depth 3)
- [ ] Critic sub-agent (dedicated system prompt, optional stronger model)
- [ ] Dashboard: sub-agent tabs on chat page (F-011)
- [ ] Dashboard: connectors page with OAuth UI (F-013)
- [ ] Dashboard: registry page (F-017)
- [ ] `packages/connectors` — generic OAuth framework, MCP registry, keychain integration
- [ ] Gmail MCP (F-102), GitHub MCP (F-103), Google Calendar MCP (F-104)
- [ ] Custom MCP add: paste URL + auth config (F-105)
- [ ] `packages/messaging` — Telegram via grammy (F-090), Discord via discord.js (F-091), Slack via bolt (F-092)
- [ ] Group-chat @handle routing (F-023)
- [ ] Rate-limit backoff for external APIs (F-137)
- [ ] Memory indexing: cross-connector entity linking (F-032, F-033)

**Phase gate:** `@coder fix this import` in a Telegram group routes to coder sub-agent, reads GitHub via MCP, replies.

---

## Phase 4 — Computer control, browser, vision, deep permissions

**Goal:** shell, files, desktop GUI, browser (3 modes), vision/OCR. Fully granular permissions.

- [ ] `packages/tools` — `shell.exec` (F-050), `fs.read`/`fs.write` (F-051) — permission-checked
- [ ] Anthropic computer-use integration (F-052)
- [ ] pyautogui + VLM local fallback (F-053)
- [ ] `services/vision-service` — Python FastAPI, Tesseract, PaddleOCR, Qwen2.5-VL
- [ ] `services/browser-service` — Playwright pool, 3 modes: scrape (F-060), headless-agent (F-061), persistent profile (F-062), pool management (F-063)
- [ ] Permission model: URL whitelist (F-042), sudo toggle (F-043), panic button (F-044)
- [ ] Approval flow: dashboard modal (F-132), Telegram inline buttons (F-133)
- [ ] Dashboard: permission toggle UI on settings page
- [ ] Security regression suite (F-167)

**Phase gate:** "open Gmail, find latest email from X, reply" works with persistent profile. Panic button stops it mid-flight.

---

## Phase 5 — Autonomy: cron, goals, critic, self-health

**Goal:** scheduled tasks fire. Goals pursued autonomously. Watchdog restarts crashed services.

- [ ] BullMQ cron scheduler reading `cron_jobs` table (F-110)
- [ ] Goal-loop worker with priority ordering (F-111)
- [ ] Notification router: SSE when dashboard open, else Telegram (F-112)
- [ ] `services/watchdog` — heartbeat monitor, restart on 90s silence (F-121)
- [ ] Agent self-tools: `self.health_check`, `self.recent_errors` (F-122)
- [ ] Stuck-loop detector: LLM judge on repeated tool calls (F-141)
- [ ] Agent edits own docs tool (F-140)
- [ ] Email trigger: Gmail label polling → session spawn → SMTP reply (F-093)
- [ ] Dashboard: cron/goals UI (F-015)
- [ ] 24h continuous project mode (manual test, F-113)

**Phase gate:** 24h scripted test runs to completion. Watchdog restarts browser service mid-run; agent continues.

---

## Phase 6 — Voice

**Goal:** voice in/out — dashboard and Telegram. Local + cloud.

- [ ] `services/voice-service` — Python FastAPI, NeMo Parakeet v3, Piper TTS, whisper.cpp fallback
- [ ] Cloud routes: Deepgram STT (F-071), ElevenLabs TTS (F-073), Whisper API
- [ ] Language auto-detection on by default (F-074)
- [ ] Dashboard: mic button + inline audio playback (F-019)
- [ ] Telegram voice message handler (grammy `message:voice`) (F-074)

**Phase gate:** German voice Telegram message → transcribe → draft email → voice reply in German. Same in dashboard.

---

## Phase 7 — Polish, hardening, ship

**Goal:** v1. Cold-start install story. npm publish.

- [ ] Local-LLM wizard fully working: weak/mid/strong tiers (F-003)
- [ ] Browser-automation skill recorder — record clicks → save Playwright script (F-106)
- [ ] Backup/restore: full Postgres + keychain export/import
- [ ] Docs pass: README, SETUP, TROUBLESHOOTING
- [ ] Cold-start <60s, first-turn latency <3s (cloud LLM)
- [ ] Cross-platform CI: macOS arm64, Linux x86_64, Linux arm64
- [ ] `pnpm readiness-check` command passes (F-170)
- [ ] `create-open-greg` published to npm
- [ ] GitHub release + tag
- [ ] 2-min demo video in README

---

## Immediate next action

1. Run `pnpm install` and `pnpm -w run typecheck` to see current compile state.
2. Check which test files actually exist vs. what `docs/FEATURES.md` references.
3. Start Phase 1 if scaffolding is missing, or Phase 2 if skeletons exist.

```bash
pnpm install
pnpm -w run typecheck 2>&1 | head -50
pnpm -w run test 2>&1 | tail -30
```

_End of TODO.md_
