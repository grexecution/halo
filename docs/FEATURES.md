# Features Registry

_Every feature has an ID (`F-NNN`), a one-line spec, acceptance criteria, and a test path. Before adding a new feature: grep this file for overlap. Before marking a feature done: add a test row. Before shipping: `pnpm test:features` must be green._

**Conventions:**

- ID format: `F-NNN` (zero-padded). Never renumber.
- Status: `planned` / `in-progress` / `done` / `deprecated`.
- Phase: which phase this ships in (see `docs/PHASES.md`).
- Test path: file path relative to repo root, or `manual:<checklist>` for manual tests.

---

## Category: Install & onboarding

### F-001 — npx bootstrap

**Status:** done · **Phase:** 1
**Spec:** `npx create-claw-alt init` clones the repo template, installs deps, starts docker services, runs the CLI wizard.
**Acceptance:** on a clean Mac Mini, from a fresh terminal, the user has a running dashboard at `localhost:3000` within 10 minutes of running the command, with no manual Docker commands.
**Test:** `apps/cli/test/bootstrap.e2e.ts`

### F-002 — CLI wizard

**Status:** done · **Phase:** 1
**Spec:** interactive TUI that walks through: LLM provider, local-LLM install (weak/mid/strong/none), messaging platform, optional MCPs, filesystem permissions, default agent persona.
**Acceptance:** all choices are stored. Wizard is idempotent (re-run updates config without destroying data).
**Test:** `apps/cli/test/wizard.spec.ts`

### F-003 — Local LLM one-click install

**Status:** planned · **Phase:** 1
**Spec:** wizard offers three tiers (weak: 3B, mid: 14B, strong: 32B/70B). Installs via Ollama `pull` in the background, shows progress.
**Acceptance:** selected model is pullable and callable from the dashboard after wizard completes.
**Test:** `apps/cli/test/local-llm.spec.ts`

### F-004 — Docker compose lifecycle

**Status:** done · **Phase:** 1
**Spec:** `pnpm docker:up` / `:down` manage the full stack. `pnpm docker:logs <service>` tails logs.
**Acceptance:** all services are `healthy` per docker ps within 60s of up.
**Test:** `scripts/test-docker-lifecycle.sh`

---

## Category: Dashboard UI

### F-010 — Chat page with streaming

**Status:** done · **Phase:** 2
**Spec:** main chat UI using assistant-ui, streams tokens from the control plane, displays tool calls inline.
**Acceptance:** sending a message shows streaming response, tool calls rendered as collapsible blocks.
**Test:** `apps/dashboard/test/chat.spec.tsx`

### F-011 — Sub-agent tabs

**Status:** planned · **Phase:** 3
**Spec:** chat page has tabs for main agent + each active sub-agent. Messages routed to the active tab.
**Acceptance:** switching tabs preserves history per agent.
**Test:** `apps/dashboard/test/subagent-tabs.spec.tsx`

### F-012 — Agents CRUD page

**Status:** done · **Phase:** 2
**Spec:** create/edit/delete agents. Fields: name, handle, system prompt, model, tools, permissions scope.
**Acceptance:** changes persist; form validation blocks invalid configs (e.g. empty handle).
**Test:** `apps/dashboard/test/agents-crud.spec.tsx`

### F-013 — Connectors page

**Status:** planned · **Phase:** 3
**Spec:** list all available MCPs, "Add" button launches OAuth/API-key flow, enable/disable toggles.
**Acceptance:** adding Gmail completes OAuth and stores token in keychain.
**Test:** `apps/dashboard/test/connectors.spec.tsx`

### F-014 — Memory browser

**Status:** done · **Phase:** 2
**Spec:** search memories by keyword or semantic. View entity graph. Delete individual or bulk.
**Acceptance:** searching "client X" returns all memories involving X across sources.
**Test:** `apps/dashboard/test/memory-browser.spec.tsx`

### F-015 — Cron & Goals page

**Status:** planned · **Phase:** 5
**Spec:** CRUD cron jobs and goals. Show next-fire time, history, pause/resume.
**Acceptance:** creating a cron via UI is equivalent to DB insert; pause stops firing within one tick.
**Test:** `apps/dashboard/test/cron-goals.spec.tsx`

### F-016 — Logs viewer

**Status:** done · **Phase:** 2
**Spec:** structured logs, filter by agent/tool/trace/time. Links to OTel trace view.
**Acceptance:** tool-call errors are visible and filterable within 2 seconds of occurrence.
**Test:** `apps/dashboard/test/logs.spec.tsx`

### F-017 — Registry overview page

**Status:** planned · **Phase:** 3
**Spec:** single page listing all enabled MCPs, LLM providers, npm packages, Python packages. Each with status and last-used.
**Acceptance:** adding a new MCP makes it appear in the registry within one page refresh.
**Test:** `apps/dashboard/test/registry.spec.tsx`

### F-018 — Settings page (global permissions + telemetry)

**Status:** done · **Phase:** 2
**Spec:** global permission toggles, telemetry on/off with custom OTel endpoint, backup/restore.
**Acceptance:** toggling sudo OFF blocks subsequent sudo-requiring tool calls.
**Test:** `apps/dashboard/test/settings.spec.tsx`

### F-019 — Voice in/out on dashboard

**Status:** planned · **Phase:** 6
**Spec:** mic button records → sends to voice-service → transcribed → agent turn. Replies play as audio inline when the user spoke.
**Acceptance:** round-trip voice → voice completes in <10s for a 5-second utterance on local stack.
**Test:** `apps/dashboard/test/voice.spec.tsx`

---

## Category: Agent core

### F-020 — Main agent loop

**Status:** done · **Phase:** 2
**Spec:** message → orchestrator → LLM call with tools → stream to client. Uses Vercel AI SDK.
**Acceptance:** simple "what's 2+2" message returns a streamed answer.
**Test:** `services/control-plane/test/main-loop.spec.ts`

### F-021 — Sub-agent delegation

**Status:** planned · **Phase:** 3
**Spec:** main agent can call `delegate(handle, task)` tool → spawns a sub-agent session, waits for result, integrates into response.
**Acceptance:** asking "write me a function and review it" results in coder + critic sub-agent calls, both visible as tool blocks.
**Test:** `services/control-plane/test/delegate.spec.ts`

### F-022 — Sub-agent mentions in chat

**Status:** planned · **Phase:** 3
**Spec:** `@coder` in a message routes directly to that sub-agent, skipping the main agent.
**Acceptance:** message with `@coder fix this bug` appears in the coder's tab, not main.
**Test:** `services/control-plane/test/mentions.spec.ts`

### F-023 — Telegram group-chat routing

**Status:** planned · **Phase:** 3
**Spec:** in a Telegram group, messages with `@handle` route to the sub-agent; others route to main if bot is addressed.
**Acceptance:** 3-way conversation (user + two sub-agents) works without cross-talk.
**Test:** `packages/messaging/test/telegram-group.spec.ts`

### F-024 — Critic loop

**Status:** planned · **Phase:** 5
**Spec:** before marking any goal complete, a critic sub-agent reviews and either approves or requests revision. Max 3 iterations.
**Acceptance:** a deliberately buggy code-gen task gets revised at least once before completion.
**Test:** `services/control-plane/test/critic.spec.ts`

### F-025 — Self-health awareness

**Status:** planned · **Phase:** 5
**Spec:** agent has `self.health_check()` and `self.recent_errors()` tools. If it notices a loop of failures, it stops and surfaces a summary.
**Acceptance:** when the browser service is down, agent reports "browser unavailable" instead of retrying 30 times.
**Test:** `services/control-plane/test/self-health.spec.ts`

### F-026 — Agent session resume

**Status:** done · **Phase:** 2
**Spec:** restarting the control plane mid-conversation lets the user continue where they left off; history loaded from Postgres.
**Acceptance:** restart during a 5-turn conversation; turn 6 has full context.
**Test:** `services/control-plane/test/resume.spec.ts`

---

## Category: Memory

### F-030 — Automatic chat indexing

**Status:** done · **Phase:** 2
**Spec:** every message (all channels) is indexed into Mem0 with metadata: agent_id, session_id, channel, timestamp.
**Acceptance:** sending a message via Telegram is searchable in the memory browser within 30s.
**Test:** `packages/memory/test/chat-indexing.spec.ts`

### F-031 — Pre-prompt memory injection

**Status:** done · **Phase:** 2
**Spec:** before each agent turn, top-N relevant memories injected into system context.
**Acceptance:** referencing a fact from 10 sessions ago gets recalled correctly.
**Test:** `packages/memory/test/pre-prompt-injection.spec.ts`

### F-032 — Connector pull indexing

**Status:** planned · **Phase:** 4
**Spec:** Gmail/GitHub/calendar/CRM pulls automatically index into memory.
**Acceptance:** new Gmail thread appears in memory search within 5 min.
**Test:** `packages/memory/test/connector-indexing.spec.ts`

### F-033 — Cross-source entity linking

**Status:** planned · **Phase:** 4
**Spec:** entities across sources are resolved (Gmail sender + CRM contact = same person).
**Acceptance:** query "emails from client X" returns emails whose senders are CRM-linked to X.
**Test:** `packages/memory/test/entity-linking.spec.ts`

### F-034 — Memory export

**Status:** done · **Phase:** 2
**Spec:** export entire memory store to JSON. Re-importable.
**Acceptance:** export + reimport round-trip preserves all memories and entities.
**Test:** `packages/memory/test/export-import.spec.ts`

---

## Category: Permissions

### F-040 — Permission YAML loading

**Status:** done · **Phase:** 2
**Spec:** `~/.claw-alt/permissions.yml` loaded at startup, hot-reloaded on change.
**Acceptance:** editing the YAML changes behavior within 5s without restart.
**Test:** `packages/permissions/test/yaml-loading.spec.ts`

### F-041 — Tool-call middleware

**Status:** done · **Phase:** 2
**Spec:** every tool call routes through `check(toolId, args, ctx)` → allow/deny/prompt.
**Acceptance:** a tool call with denied path returns deny; one with allowed path returns allow.
**Test:** `packages/permissions/test/middleware.spec.ts`

### F-042 — URL whitelist mode

**Status:** planned · **Phase:** 4
**Spec:** when `network.url_whitelist_mode: true`, only URLs matching `allowed_urls` are reachable.
**Acceptance:** in whitelist mode, non-whitelisted domains return deny.
**Test:** `packages/permissions/test/url-whitelist.spec.ts`

### F-043 — Sudo toggle

**Status:** planned · **Phase:** 4
**Spec:** dashboard toggle enables `filesystem.sudo`. First sudo call prompts for password, stored in keychain.
**Acceptance:** with sudo off, `sudo ls` returns deny. With sudo on, works after keychain prompt.
**Test:** `packages/permissions/test/sudo.spec.ts`

### F-044 — Panic button

**Status:** planned · **Phase:** 4
**Spec:** single button in dashboard flips all permissions to false and kills in-flight tool calls.
**Acceptance:** clicking panic stops any running browser/shell session within 2 seconds.
**Test:** `apps/dashboard/test/panic.spec.tsx`

### F-045 — Non-bypassable middleware (lint rule)

**Status:** done · **Phase:** 2
**Spec:** ESLint custom rule forbids direct tool-handler calls that skip the middleware.
**Acceptance:** a PR introducing a direct call fails CI.
**Test:** `packages/permissions/test/lint-rule.spec.ts`

---

## Category: Computer control

### F-050 — Shell exec

**Status:** planned · **Phase:** 4
**Spec:** `shell.exec` tool runs commands with permission checks on cwd and path args.
**Acceptance:** `echo hi` works; `cat ~/.ssh/id_rsa` denied when path is blacklisted.
**Test:** `packages/tools/test/shell.spec.ts`

### F-051 — Filesystem read/write

**Status:** planned · **Phase:** 4
**Spec:** `fs.read` and `fs.write` with path checks.
**Acceptance:** writing outside `allowed_paths` denied.
**Test:** `packages/tools/test/fs.spec.ts`

### F-052 — Desktop GUI (computer-use)

**Status:** planned · **Phase:** 4
**Spec:** Anthropic computer-use integrated as a tool. Permission-gated.
**Acceptance:** "take a screenshot of the desktop" works when permission is granted.
**Test:** `packages/tools/test/gui.spec.ts`

### F-053 — Desktop GUI (local fallback)

**Status:** planned · **Phase:** 4
**Spec:** pyautogui + VLM fallback for local-LLM users.
**Acceptance:** same tool calls work with Ollama + Qwen2.5-VL.
**Test:** `services/vision-service/test/gui-local.spec.py`

---

## Category: Browser

### F-060 — Browser scraping mode

**Status:** planned · **Phase:** 4
**Spec:** `browser.scrape(url, selector?)` → text content.
**Acceptance:** scraping `example.com` returns expected text.
**Test:** `services/browser-service/test/scrape.spec.ts`

### F-061 — Browser agent mode (headless + vision)

**Status:** planned · **Phase:** 4
**Spec:** `browser.act(goal)` — screenshot + VLM + click/type loop, max 30 steps.
**Acceptance:** fills and submits a test form at `test-form.local`.
**Test:** `services/browser-service/test/act.spec.ts`

### F-062 — Persistent browser profile

**Status:** planned · **Phase:** 4
**Spec:** `browser.act(goal, {persistent: true})` uses `~/.claw-alt/browser-profile/`. Cookies persist across runs.
**Acceptance:** logging in once persists across `compose down && up`.
**Test:** `services/browser-service/test/persistent.spec.ts`

### F-063 — Browser pool management

**Status:** planned · **Phase:** 4
**Spec:** single pool, max N concurrent contexts (default 3). Requests queue.
**Acceptance:** 5 concurrent `browser.act` calls run sequentially with N=3.
**Test:** `services/browser-service/test/pool.spec.ts`

---

## Category: Voice

### F-070 — Local STT (Parakeet)

**Status:** planned · **Phase:** 6
**Spec:** Parakeet-v3 transcribes audio, auto-detects language.
**Acceptance:** 10s German audio transcribes with <10% WER.
**Test:** `services/voice-service/test/stt-parakeet.spec.py`

### F-071 — Cloud STT fallback

**Status:** planned · **Phase:** 6
**Spec:** when `voice.stt=cloud`, routes to Deepgram or Whisper API.
**Acceptance:** cloud STT matches or beats local latency.
**Test:** `services/voice-service/test/stt-cloud.spec.py`

### F-072 — Local TTS (Piper)

**Status:** planned · **Phase:** 6
**Spec:** Piper synthesizes audio in the user's language.
**Acceptance:** German text produces German audio.
**Test:** `services/voice-service/test/tts-piper.spec.py`

### F-073 — Cloud TTS (ElevenLabs)

**Status:** planned · **Phase:** 6
**Spec:** when enabled, routes to ElevenLabs.
**Acceptance:** API-key flow + audio produced.
**Test:** `services/voice-service/test/tts-elevenlabs.spec.py`

### F-074 — Telegram voice round-trip

**Status:** planned · **Phase:** 6
**Spec:** voice message in Telegram → transcribed → agent → reply as voice (if user used voice).
**Acceptance:** round-trip works in <15s local stack.
**Test:** `packages/messaging/test/telegram-voice.spec.ts`

---

## Category: Vision / OCR

### F-080 — Image description

**Status:** planned · **Phase:** 4
**Spec:** `vision.describe(path)` returns text description.
**Acceptance:** test image → sensible description.
**Test:** `services/vision-service/test/describe.spec.py`

### F-081 — OCR simple

**Status:** planned · **Phase:** 4
**Spec:** `vision.ocr(path)` via Tesseract.
**Acceptance:** clear screenshot of text → accurate transcription.
**Test:** `services/vision-service/test/ocr-tesseract.spec.py`

### F-082 — OCR layout mode

**Status:** planned · **Phase:** 4
**Spec:** `vision.ocr(path, {mode: 'layout'})` via PaddleOCR.
**Acceptance:** multi-column PDF page extracted in reading order.
**Test:** `services/vision-service/test/ocr-paddle.spec.py`

---

## Category: Messaging

### F-090 — Telegram bot basic

**Status:** planned · **Phase:** 3
**Spec:** grammy-based bot. Responds to DMs.
**Acceptance:** user message → bot reply within 5s.
**Test:** `packages/messaging/test/telegram-basic.spec.ts`

### F-091 — Discord bot

**Status:** planned · **Phase:** 3
**Spec:** discord.js-based. Slash commands per sub-agent.
**Acceptance:** `/coder fix bug` routes correctly.
**Test:** `packages/messaging/test/discord.spec.ts`

### F-092 — Slack bot

**Status:** planned · **Phase:** 3
**Spec:** @slack/bolt. Threads = sessions.
**Acceptance:** thread reply maintains session context.
**Test:** `packages/messaging/test/slack.spec.ts`

### F-093 — Email trigger

**Status:** planned · **Phase:** 5
**Spec:** Gmail label-filtered polling triggers agent sessions. Agent can reply via SMTP.
**Acceptance:** emailing the configured address with label `claw` spawns a session.
**Test:** `packages/messaging/test/email.spec.ts`

---

## Category: Connectors / MCP

### F-100 — MCP client registry

**Status:** planned · **Phase:** 3
**Spec:** register/unregister MCPs at runtime. List with status.
**Acceptance:** adding an MCP makes its tools callable on next turn.
**Test:** `packages/connectors/test/registry.spec.ts`

### F-101 — OAuth flow framework

**Status:** planned · **Phase:** 3
**Spec:** generic OAuth redirect handler at `/oauth/callback/:connector-id`, tokens to keychain.
**Acceptance:** Gmail OAuth completes without manual token copy.
**Test:** `packages/connectors/test/oauth.spec.ts`

### F-102 — Gmail connector

**Status:** planned · **Phase:** 3
**Spec:** Gmail MCP with read + send.
**Acceptance:** agent can list unread and send a reply.
**Test:** `packages/connectors/test/gmail.spec.ts`

### F-103 — GitHub connector

**Status:** planned · **Phase:** 3
**Spec:** GitHub MCP with issues, PRs, repo read, PR create.
**Acceptance:** agent creates a PR in a test repo.
**Test:** `packages/connectors/test/github.spec.ts`

### F-104 — Google Calendar connector

**Status:** planned · **Phase:** 3
**Spec:** read/write events.
**Acceptance:** "what's my next meeting" returns it.
**Test:** `packages/connectors/test/calendar.spec.ts`

### F-105 — Custom MCP add

**Status:** planned · **Phase:** 3
**Spec:** paste URL + config → connector added.
**Acceptance:** a dummy MCP server becomes callable.
**Test:** `packages/connectors/test/custom.spec.ts`

### F-106 — Browser-automation skill recorder

**Status:** planned · **Phase:** 7
**Spec:** for tools without MCP (e.g. FeedBucket), user records clicks → agent replays via Playwright.
**Acceptance:** recorded login flow replays successfully.
**Test:** `services/browser-service/test/recorder.spec.ts`

---

## Category: Autonomy

### F-110 — Cron scheduler

**Status:** planned · **Phase:** 5
**Spec:** BullMQ-repeatable jobs driven by `cron_jobs` table.
**Acceptance:** every-minute job fires exactly once per minute, ±2s.
**Test:** `services/control-plane/test/cron.spec.ts`

### F-111 — Goal loop worker

**Status:** planned · **Phase:** 5
**Spec:** worker picks active goals by priority and runs them.
**Acceptance:** three goals run in priority order.
**Test:** `services/control-plane/test/goal-loop.spec.ts`

### F-112 — Notification routing

**Status:** planned · **Phase:** 5
**Spec:** goal/cron completion notifies via configured channel (default Telegram).
**Acceptance:** scheduled task result arrives as Telegram message.
**Test:** `services/control-plane/test/notifications.spec.ts`

### F-113 — Continuous project mode

**Status:** planned · **Phase:** 5
**Spec:** agent given a long-running project goal keeps working: picks subtasks, self-critiques, researches online, reports daily.
**Acceptance:** a 24h session produces at least one concrete output + a progress summary.
**Test:** `manual:continuous-project-24h`

---

## Category: Crash resilience

### F-120 — Docker restart policies

**Status:** done · **Phase:** 1
**Spec:** every service `restart: unless-stopped`.
**Acceptance:** killing a container → Docker restarts it within 10s.
**Test:** `scripts/test-restart.sh`

### F-121 — Watchdog heartbeats

**Status:** planned · **Phase:** 5
**Spec:** every service heartbeats every 30s; watchdog restarts silent services after 90s.
**Acceptance:** simulated service hang → watchdog restart + event emitted.
**Test:** `services/watchdog/test/watchdog.spec.ts`

### F-122 — Agent self-diagnose

**Status:** planned · **Phase:** 5
**Spec:** agent tools `self.health_check` and `self.recent_errors`.
**Acceptance:** with one service down, `self.health_check` reports it.
**Test:** `services/control-plane/test/self-diagnose.spec.ts`

---

## Feature-test runner

`pnpm test:features` does the following:

1. Reads this file, extracts every row with `Status: done` and `Test: <path>`.
2. Runs each test file.
3. Prints a summary: `N/M features passing`.
4. Fails CI if any done feature's test fails.

The runner lives at `scripts/test-features.ts` and parses this markdown with a simple regex — no fancy schema. Keep the format consistent.

---

## Category: Safety & cost controls

### F-130 — Per-session budget enforcement

**Status:** done · **Phase:** 2
**Spec:** each session has `max_tokens`, `max_cost_usd`, `max_tool_calls`, `max_wall_time_seconds`. Exceeding any aborts the session cleanly.
**Acceptance:** budget set to 100 tokens; session aborts on 5th turn of a looping task.
**Test:** `services/control-plane/test/budget-session.spec.ts`

### F-131 — Daily spend cap

**Status:** done · **Phase:** 2
**Spec:** global daily cost cap. Soft warning banner at 40%, hard stop at 100%. Reset at local midnight.
**Acceptance:** reaching cap blocks new sessions; reset at midnight restores access.
**Test:** `services/control-plane/test/budget-daily.spec.ts`

### F-132 — Approval flow (dashboard)

**Status:** planned · **Phase:** 4
**Spec:** destructive actions (list in `docs/PERMISSIONS.md#approval-flow`) prompt user. 5-min timeout → deny.
**Acceptance:** triggering `email.send` shows approval modal; clicking "Allow" proceeds, "Deny" aborts.
**Test:** `apps/dashboard/test/approval.spec.tsx`

### F-133 — Approval flow (Telegram)

**Status:** planned · **Phase:** 4
**Spec:** same as F-132 but via Telegram inline buttons when user is on mobile.
**Acceptance:** approval request shown as inline keyboard in chat.
**Test:** `packages/messaging/test/telegram-approval.spec.ts`

### F-134 — Tool timeouts

**Status:** done · **Phase:** 2
**Spec:** every tool call has a timeout. Timeout → clean failure, no hang.
**Acceptance:** tool with `sleep 300` aborts at default 60s.
**Test:** `services/control-plane/test/timeout.spec.ts`

### F-135 — Secrets: keychain with headless fallback

**Status:** done · **Phase:** 1
**Spec:** keytar primary; on failure (headless Linux) fall back to AES-256-GCM file + env passphrase.
**Acceptance:** works on macOS. Works on headless Ubuntu with `CLAW_SECRET_PASSPHRASE` set. Fails fast if passphrase missing on fallback path.
**Test:** `packages/shared/test/secrets.spec.ts`

### F-136 — Pino redaction

**Status:** done · **Phase:** 2
**Spec:** secret field names auto-redacted in logs and OTel spans.
**Acceptance:** log line containing an API key appears as `***REDACTED***`.
**Test:** `packages/telemetry/test/redaction.spec.ts`

### F-137 — Rate-limit backoff for external APIs

**Status:** planned · **Phase:** 3
**Spec:** Gmail, GitHub, Slack, etc. — exponential backoff on 429. Track quota state per connector.
**Acceptance:** forcing 5 consecutive 429s leads to graceful backoff, not infinite retry.
**Test:** `packages/connectors/test/rate-limit.spec.ts`

---

## Category: Agent self-management

### F-140 — Agent edits own docs

**Status:** planned · **Phase:** 5
**Spec:** `docs.edit(file, changes)` tool, permission-gated (default on for main, off for sub-agents). Every edit creates a git commit with trace metadata.
**Acceptance:** asking main agent to update `docs/FEATURES.md` with a feature status creates a commit.
**Test:** `packages/tools/test/docs-edit.spec.ts`

### F-141 — Stuck-loop detector

**Status:** planned · **Phase:** 5
**Spec:** LLM judge on last N turn deltas returns "no progress" → orchestrator injects reset-prompt.
**Acceptance:** 3 repeated identical tool calls triggers detector.
**Test:** `services/control-plane/test/stuck.spec.ts`

---

## Category: Timezone & locale

### F-150 — Timezone in agent prompts

**Status:** done · **Phase:** 2
**Spec:** `~/.claw-alt/config.yml` stores IANA timezone. Every agent system prompt prefixed with "Current date and time: <now in TZ>."
**Acceptance:** "what's today's date" returns correct local date across DST boundaries.
**Test:** `packages/agent-core/test/timezone.spec.ts`

---

## Category: Self-repair & self-test infrastructure

### F-160 — Feature-test CI enforcement

**Status:** done · **Phase:** 1
**Spec:** GitHub Action parses `docs/FEATURES.md`, verifies every row with `Status: done` has its test file existing, outer describe matching `F-NNN: <title>`, and the test passing. Blocks PR on violation.
**Acceptance:** PR that marks a feature done without a matching test fails CI loudly.
**Test:** `scripts/test-features.spec.ts`

### F-161 — STUCK.md escalation protocol

**Status:** done · **Phase:** 1
**Spec:** When the build agent hits the 5-attempt limit on a feature, it writes `STUCK.md` in the feature's directory with required sections (tried, error, hypothesis, next). CI detects any `STUCK.md` presence and fails the build with a clear message.
**Acceptance:** CI detects a `STUCK.md` anywhere in the repo and fails with a reference to `docs/SELF_REPAIR.md`.
**Test:** `scripts/test-stuck-enforcement.sh`

### F-162 — Regression detection

**Status:** done · **Phase:** 2
**Spec:** `pnpm test:features` tracks pass/fail history in `artifacts/feature-history.jsonl` (append-only). Previously-done features that now fail are reported as `REGRESSION` distinct from new-feature `FAIL`.
**Acceptance:** marking a done feature broken produces output labeled `REGRESSION: F-NNN`, not just `FAIL`.
**Test:** `scripts/test-regression-detector.spec.ts`

### F-163 — Nightly regression build

**Status:** done · **Phase:** 2
**Spec:** GitHub Action runs nightly: full teardown (`docker:down --volumes`), rebuild, migrate, seed, run `pnpm test && pnpm test:features && pnpm test:e2e`. Posts results to `artifacts/nightly/<date>.json`. Notifies via Telegram on regression.
**Acceptance:** nightly run on a known-good commit stays green 3 consecutive nights. Injected regression triggers the notification.
**Test:** `scripts/verify-nightly.sh`

### F-164 — Build-health dashboard page

**Status:** done · **Phase:** 2
**Spec:** `/build-health` page shows current pass rate, regressions in last 7 days, test-duration trends, active `STUCK.md` files with links.
**Acceptance:** inducing a regression surfaces it on the page within one nightly run.
**Test:** `apps/dashboard/test/build-health.spec.tsx`

### F-165 — Bounded auto-retry for flaky tests

**Status:** done · **Phase:** 2
**Spec:** Vitest configured with `retry: 1` for integration tests, `retry: 0` for unit tests. Flaky tests tracked in `artifacts/flakiness.jsonl`. A test flaking 3+ consecutive runs is auto-quarantined and an issue is created (Phase 5+ does this via the agent; before Phase 5 sends a Telegram).
**Acceptance:** forcing a deterministic flake 3 times moves the test to the quarantine list.
**Test:** `scripts/test-flake-detection.spec.ts`

### F-166 — Pre-commit hook bundle

**Status:** done · **Phase:** 1
**Spec:** husky + lint-staged. On commit: format staged files, run `typecheck`, run tests for touched files only, scan for secrets with gitleaks. Block commit on any failure.
**Acceptance:** attempt to commit a file containing a hardcoded API key is blocked by gitleaks.
**Test:** `scripts/test-precommit.sh`

### F-167 — Security regression suite

**Status:** planned · **Phase:** 4
**Spec:** dedicated suite asserting: denied paths stay denied, sudo toggle actually blocks, panic button kills in-flight sessions, URL whitelist blocks non-whitelisted, permission middleware is non-bypassable. Runs on every PR and nightly.
**Acceptance:** deliberately introducing any of these regressions makes the suite fail loudly with the specific rule violated.
**Test:** `test/security-regression/*.spec.ts`

### F-168 — Fail-fast rescue branch

**Status:** done · **Phase:** 1
**Spec:** When the agent hits a fail-fast condition (see `docs/SELF_REPAIR.md#8`), it commits the current state to `rescue/<yyyy-mm-dd>-<reason>` branch, writes a summary to `RESCUE.md`, and stops. Human must explicitly merge or discard.
**Acceptance:** triggering a simulated fail-fast condition produces the rescue branch and halts further work.
**Test:** `scripts/test-rescue-flow.sh`

### F-169 — Cost tracking per build session

**Status:** done · **Phase:** 1
**Spec:** CLI tracks LLM token usage during the build (requires integration with Claude Code's logging or a wrapper). Writes `artifacts/build-cost.jsonl`. Soft warning at $10, hard stop at $50 (configurable). Prevents runaway self-repair loops from burning money unnoticed.
**Acceptance:** simulated token usage exceeding hard cap aborts the session with a summary.
**Test:** `scripts/test-cost-tracking.spec.ts`

### F-170 — Production readiness checklist

**Status:** planned · **Phase:** 7
**Spec:** a single `pnpm readiness-check` command runs the full production-readiness checklist from `docs/SELF_REPAIR.md#7`: all features done/deferred, `pnpm test:features` 3 runs in a row green, demos pass, 0 STUCK.md, security suite green, cross-platform CI green, nightly green 7 days, perf thresholds met. Outputs a pass/fail report.
**Acceptance:** on a fully-complete build, outputs `READY`. On a build missing any criterion, outputs `NOT READY` with the specific gap.
**Test:** `scripts/test-readiness-check.spec.ts`

---

## Feature-test runner

`pnpm test:features` does the following:

1. Reads this file, extracts every row with `Status: done` and `Test: <path>`.
2. Runs each test file. Compares results against `artifacts/feature-history.jsonl` to detect regressions.
3. Prints a summary: `N/M features passing`, separated into: passes, new failures, regressions.
4. Fails CI if any done feature's test fails.
5. Appends this run's results to `artifacts/feature-history.jsonl` (append-only log).

The runner lives at `scripts/test-features.ts` and parses this markdown with a simple regex — no fancy schema. Keep the format consistent.

---

_End of FEATURES.md._
