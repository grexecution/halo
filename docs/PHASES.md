# Build Phases

_Seven phases. Each phase ships something usable on its own. The master build prompt (`BUILD_PROMPT.md`) walks through them in order._

**Phase exit criteria:** phase is "complete" when (a) every feature in the phase is status=done in `docs/FEATURES.md`, (b) `pnpm test:features` is green, and (c) the demo scenario at the end of each phase works end-to-end.

---

## Phase 1 — Skeleton & install story

**Goal:** a user can run `npx create-open-greg init` and get a blank dashboard on localhost. Nothing intelligent yet. Just the scaffolding.

**Features:** F-001, F-002, F-004, F-120, F-135, F-160, F-161, F-166, F-168, F-169.

**Tasks:**

1. Initialize pnpm monorepo with workspaces: `apps/cli`, `apps/dashboard`, `services/control-plane`, `packages/shared`.
2. Set up TypeScript configs, ESLint (+ the custom "no-bypass-permission" rule stub), Prettier.
3. Write `apps/cli` — Ink-based TUI (or clack). Bootstrap: clone template, install deps, generate `CLAW_SECRET_PASSPHRASE` (if headless), `docker compose up -d`, wait for health, print URL.
4. Write `docker/compose.yml` with Postgres, Redis, Ollama (tier chosen later). Every service has `restart: unless-stopped` AND a Dockerfile `HEALTHCHECK` directive (not just a compose healthcheck — both).
5. Write `apps/dashboard` — Next.js 15 scaffold, Tailwind, shadcn/ui installed, one empty page.
6. Write `services/control-plane` — Fastify skeleton, `/health` endpoint, tRPC router stub.
7. Write `packages/shared/secrets.ts` — keytar wrapper with AES-GCM fallback. Detection at first read.
8. `.env.example` in every service with documented variables. CLI reads `.env` chain and warns on missing required ones.
9. **Cross-platform verification from day 1:** CI matrix runs Phase 1 demo on `ubuntu-latest` (x86_64), `ubuntu-24.04-arm` (arm64), and `macos-14` (Apple Silicon). If it doesn't install on all three, Phase 1 isn't done.
10. CI: GitHub Actions for lint + typecheck on PR.
11. Write test: fresh clone + `pnpm install` + `pnpm docker:up` → dashboard returns 200. Secrets roundtrip works on all three platforms.

**Demo:** `npx create-open-greg init` on a clean machine → `http://localhost:3000` shows a placeholder dashboard. Tested on macOS, Linux x86_64, Linux arm64.

**Exit:** F-001, F-002, F-004, F-120, F-135 all green on all three platforms.

---

## Phase 2 — Core chat loop, memory, base permissions

**Goal:** a user can chat with a single Claude-backed agent in the dashboard. Messages persist. Memory is indexed. Basic permission framework exists. No tools yet except a trivial `get_time`.

**Features:** F-010, F-012, F-014, F-016, F-018, F-020, F-026, F-030, F-031, F-034, F-040, F-041, F-045, F-130, F-131, F-134, F-136, F-150, F-162, F-163, F-164, F-165.

**Tasks:**

1. `packages/shared` — zod schemas for Message, Agent, ToolCall, Permission. OTel wrapper.
2. `packages/agent-core` — AgentOrchestrator class. `runTurn(agentId, message)` method using Vercel AI SDK v6 (`@ai-sdk/mcp` for MCP integration).
3. `packages/permissions` — YAML loader (chokidar for hot-reload), `check()` function, ESLint rule.
4. `packages/memory` — Mem0 OpenMemory client wrapper. `index()` and `search()` methods.
5. `packages/tools` — register a trivial `get_time` tool going through the middleware.
6. `services/control-plane` — tRPC routers: `agents.*`, `messages.*`, `memory.*`, `settings.*`. SSE for streaming responses.
7. DB: Drizzle schema + migrations for `agents`, `messages`, `memories`, `tool_calls`, `permissions`.
8. `apps/dashboard` — chat page, agents page, memory page, settings page, logs page.
9. `docker/compose.yml` — add Mem0 OpenMemory container + Qdrant.
10. Write a default agent during wizard ("Claw" with a generalist system prompt).
11. Write tests for each feature.

**Demo:** send a message → streamed response with `get_time` tool call → restart control plane → continue conversation with full context → search memory finds the message.

**Exit:** all phase features green. `pnpm test:features` reports 14/14 for phase 2 features.

---

## Phase 3 — Sub-agents, connectors, messaging

**Goal:** delegate to sub-agents. Connect Gmail/GitHub/Calendar. Telegram/Discord/Slack channels work. Registry view shows everything.

**Features:** F-011, F-013, F-017, F-021, F-022, F-023, F-090, F-091, F-092, F-100, F-101, F-102, F-103, F-104, F-105, F-137.

**Tasks:**

1. Extend AgentOrchestrator for sub-agents: handle mentions, `delegate` tool, nested sessions.
2. Dashboard: sub-agent tabs on chat page.
3. Dashboard: connectors page with OAuth flow UI.
4. `packages/connectors` — generic OAuth framework, MCP client registry, keychain integration.
5. Wire Gmail MCP, GitHub MCP, Google Calendar MCP.
6. Custom MCP add: paste URL + auth config → register.
7. `packages/messaging` — Telegram (grammy), Discord (discord.js), Slack (bolt). Group-chat handle routing.
8. Dashboard: registry page listing MCPs + LLMs + npm packages + Python packages.
9. npm package tracker: wrap `require` at control-plane startup to log loaded packages.
10. Tests for each.

**Demo:** in a Telegram group with the bot, `@coder fix this import` routes to the coder sub-agent, which reads the GitHub repo via MCP, drafts a change, and replies. The registry page shows Gmail, GitHub, Telegram, Calendar all enabled with their last-used timestamps.

**Exit:** all phase features green. Group-chat routing works. OAuth flows work without manual token copy.

---

## Phase 4 — Computer control, browser, vision, deep permissions

**Goal:** agent can control shell, files, browser (3 modes), desktop GUI. Vision/OCR works. Permission model is fully granular.

**Features:** F-032, F-033, F-042, F-043, F-044, F-050, F-051, F-052, F-053, F-060, F-061, F-062, F-063, F-080, F-081, F-082, F-132, F-133, F-167.

**Tasks:**

1. `packages/tools` — shell.exec, fs.read, fs.write. Permission-checked.
2. Anthropic computer-use integration (cloud path).
3. `services/vision-service` — Python FastAPI, Tesseract, PaddleOCR, Qwen2.5-VL via Ollama.
4. `services/browser-service` — Playwright with three modes + pool.
5. Permission model: URL whitelist, sudo toggle, panic button.
6. Dashboard: permission toggle UI on settings page.
7. Connector pull → memory indexing pipeline.
8. Entity linking via Mem0 features.
9. Tests including security-regression tests (denied paths stay denied).

**Demo:** "Open Gmail, find the latest email from CLIENT_NAME, reply with an acknowledgement" works on the Mac Mini in persistent-profile mode, with no manual login, no human intervention. Panic button stops it mid-flight.

**Exit:** all phase features green. Security tests pass — sudo off means sudo blocked, URL whitelist blocks non-whitelisted, panic kills in-flight.

---

## Phase 5 — Autonomy: cron, goals, critic, self-health

**Goal:** agent runs autonomously. Scheduled tasks fire. Long-running goals are pursued. Agent critiques its own work. Agent knows when it's stuck.

**Features:** F-015, F-024, F-025, F-093, F-110, F-111, F-112, F-113, F-121, F-122, F-140, F-141.

**Tasks:**

1. BullMQ-based cron scheduler reading `cron_jobs`.
2. Goal-loop worker reading `goals`.
3. Notification router (goal done → configured channel).
4. Critic sub-agent (distinct system prompt, optional stronger model).
5. `services/watchdog` — separate Node service, heartbeats, restarts.
6. Agent self-tools: `self.health_check`, `self.recent_errors`, stuck-loop detector.
7. Email trigger (Gmail polling → session spawn → SMTP reply).
8. Dashboard cron/goals UI.
9. 24h continuous-project integration test (scripted: simulated clock).

**Demo:** set a goal "improve the landing page for project X, keep working on it and check in daily." Agent researches, proposes changes, opens a PR, sends a Telegram summary. Next day, agent resumes: reviews feedback on the PR, iterates. Kill the browser service mid-run; agent notices, watchdog restarts it, agent continues.

**Exit:** all phase features green. 24h scripted test runs to completion without human intervention and without getting stuck.

---

## Phase 6 — Voice

**Goal:** voice in and out, both dashboard and Telegram. Local + cloud paths.

**Features:** F-019, F-070, F-071, F-072, F-073, F-074.

**Tasks:**

1. `services/voice-service` — Python FastAPI. NeMo (Parakeet v3), Piper, whisper.cpp fallback.
2. Cloud routes: Deepgram, Whisper API, ElevenLabs.
3. Dashboard chat: mic button, inline audio playback.
4. Telegram voice message handling (grammy `message:voice` filter).
5. Language detection: on by default, per-agent override.
6. Tests for STT WER, TTS round-trip, channel routing.

**Demo:** send a German voice message via Telegram. Agent transcribes, acts (e.g., drafts an email), replies with a voice message in German. Same in dashboard.

**Exit:** all phase features green.

---

## Phase 7 — Polish, registry extras, install hardening

**Goal:** ship v1. Everything refined. Install story works cold-start.

**Features:** F-003, F-106, F-170, any deferred polish.

**Tasks:**

1. Local-LLM wizard (weak/mid/strong) fully working.
2. Browser-automation skill recorder — user clicks through a flow, Playwright script saved.
3. Backup/restore: full Postgres + keychain export/import.
4. Docs pass: README, SETUP, TROUBLESHOOTING.
5. Performance pass: cold-start time <60s, first-turn latency <3s for cloud LLM.
6. Cross-platform testing: Mac Mini (arm64), Linux x86_64, Linux arm64.
7. Publish `create-open-greg` to npm. GitHub release with tag.
8. Record a 2-minute demo video for the README.

**Demo:** clean install on a Linux box. `npx create-open-greg init`. Under 10 minutes to first working conversation. All prior demos still pass.

**Exit:** npm package published. All features across all phases green. Release notes written.

---

## Phase timing estimates (solo, focused)

| Phase     | Estimated days |
| --------- | -------------- |
| 1         | 2–3            |
| 2         | 4–6            |
| 3         | 4–6            |
| 4         | 5–7            |
| 5         | 4–5            |
| 6         | 2–3            |
| 7         | 2–3            |
| **Total** | **23–33 days** |

With an AI coding agent running overnight, the clock time can be compressed significantly — the bottleneck becomes human review between phases, not code generation.

---

## MVP cuts (if time runs out)

If the build exceeds schedule and a cut is required, the priority order for de-scoping is:

**Can defer to v1.1 without hurting core value:**

1. Voice (Phase 6 entirely) — Telegram text works without it.
2. Discord and Slack (F-091, F-092) — Telegram covers messaging.
3. Email trigger (F-093) — users can forward to Telegram.
4. Browser-automation skill recorder (F-106) — custom MCP add covers the gap.
5. Multiple local LLM tiers (F-003 tiered install) — ship one tier (mid).

**Do NOT cut** (these define the product):

- Permission middleware + panic button + budgets — this is the differentiator vs OpenClaw.
- Memory + cross-source indexing — this is the "actually useful" piece.
- Cron + goal loop + critic — this is the "actually autonomous" piece.
- Crash resilience (watchdog + self-health) — this is the "doesn't go idle" piece.
- Telegram messaging — this is the "works on mobile" piece.

If more than 30% over schedule, stop adding features and stabilize. A shipped v1.0 missing voice is better than a half-built v1.0 with broken voice.

---

_End of PHASES.md._
