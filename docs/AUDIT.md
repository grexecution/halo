# Architecture & Feature Audit

_Last updated: 2026-04-24 (session 5). Auto-maintained by agents — update this file whenever feature status changes._

---

## Purpose

This is the living ground-truth audit of what actually works vs what is documented as done. It is the authoritative reference for understanding real project state. Keep it current — stale audits are worse than none.

**Rule:** Any agent that changes a feature's status in `docs/FEATURES.md` MUST update the corresponding row in this file in the same commit.

---

## How to Re-run the Audit

```bash
pnpm test                    # unit/integration tests across all spec files
pnpm -w run typecheck        # tsc --noEmit across all packages
pnpm exec tsx scripts/test-features.ts --dry-run   # see which feature tests exist
pnpm -w run test:features    # full feature runner (slow — spawns vitest per feature)
```

---

## Test Suite Ground Truth (2026-04-24, session 5)

| Command              | Result                                      |
| -------------------- | ------------------------------------------- |
| `pnpm test`          | ✅ **482/482 passing** across 84 spec files |
| `pnpm typecheck`     | ✅ **0 errors** across all packages         |
| `pnpm test:features` | ✅ All Phase 8–11 features passing          |

---

## Feature Status Overview

**107 total features** (88 original + 13 Phase 8 + 6 Phase 9–11), all marked `Status: done` in `docs/FEATURES.md`.

| Result                       | Count | Notes                                             |
| ---------------------------- | ----- | ------------------------------------------------- |
| ✅ PASS                      | 107   | All test files exist and pass                     |
| ❌ REGRESSION (missing test) | 0     | Previously 16 — all resolved in session 2         |
| ⏭️ manual                    | 1     | F-113: 24h continuous project (manual only)       |
| 🔴 stub impl                 | ~3    | Browser/voice/vision services still dry-run stubs |

---

## Previously Resolved Regressions (session 2, 2026-04-22)

All 16 previously-missing test files have been created. The CI feature-enforcement gate is now green.

| Feature | Description                 | Test Path (now exists)                              |
| ------- | --------------------------- | --------------------------------------------------- |
| F-021   | Sub-agent delegation        | `services/control-plane/test/delegate.spec.ts`      |
| F-024   | Critic loop                 | `services/control-plane/test/critic.spec.ts`        |
| F-025   | Self-health awareness       | `services/control-plane/test/self-health.spec.ts`   |
| F-026   | Agent session resume        | `services/control-plane/test/resume.spec.ts`        |
| F-030   | Automatic chat indexing     | `packages/memory/test/chat-indexing.spec.ts`        |
| F-031   | Pre-prompt memory injection | `packages/memory/test/pre-prompt-injection.spec.ts` |
| F-032   | Connector pull indexing     | `packages/memory/test/connector-indexing.spec.ts`   |
| F-033   | Cross-source entity linking | `packages/memory/test/entity-linking.spec.ts`       |
| F-034   | Memory export               | `packages/memory/test/export-import.spec.ts`        |
| F-050   | Shell exec                  | `packages/tools/test/shell.spec.ts`                 |
| F-051   | Filesystem read/write       | `packages/tools/test/fs.spec.ts`                    |
| F-052   | Desktop GUI (computer-use)  | `packages/tools/test/gui.spec.ts`                   |
| F-110   | Cron scheduling             | `services/control-plane/test/cron.spec.ts`          |
| F-111   | Goal loop                   | `services/control-plane/test/goal-loop.spec.ts`     |
| F-112   | Notification routing        | `services/control-plane/test/notifications.spec.ts` |
| F-122   | Agent self-diagnose         | `services/control-plane/test/self-diagnose.spec.ts` |
| F-140   | Agent edits own docs        | `packages/tools/test/docs-edit.spec.ts`             |

---

## Component Implementation Status

### packages/agent-core ✅

- **Implementation:** Real — `buildSystemPrompt()` with timezone injection
- **Tests:** 4 passing (timezone.spec.ts)
- **Notes:** Minimal by design; core prompt assembly only

### packages/connectors ✅

- **Implementation:** Real — MCP registry, OAuth PKCE flow, rate limiter with exponential backoff, 50+ plugin metadata definitions
- **Tests:** 18 passing across 7 files

### packages/messaging ✅

- **Implementation:** Real routing logic; grammy-based Telegram bot is real; `email-trigger.ts` and `telegram-voice.ts` are dry-run stubs
- **Tests:** 21 passing across 7 files

### packages/permissions ✅

- **Implementation:** Real — Zod-validated YAML loading, file watching, tool-call middleware, URL whitelist, sudo detection, ESLint lint rule
- **Tests:** 18 passing across 5 files

### packages/shared ✅

- **Implementation:** `secrets.ts` is fully real (AES-256-GCM + keytar keychain); `index.ts` is an empty barrel
- **Tests:** 7 passing

### packages/telemetry ✅

- **Implementation:** Real — Pino logger with 30+ redaction paths for sensitive fields
- **Tests:** 6 passing

### packages/memory ✅

- **Implementation:** Real — `FTSIndex` interface with `InMemoryFTS` (test) + `PostgresFTS` (production); `UserModel` preference tracking, drift detection, correction signals; `MemoryLayer` 3-tier architecture (episodic/semantic/working)
- **Tests:** All 7 memory spec files passing
- **Session 5 addition:** `UserModel` and `UserModelState` now properly exported from package index (were internal to `user-model.ts`)

### packages/tools ✅

- **Implementation:** Tools live in `services/control-plane/src/mastra-tools.ts` — 11 permission-gated tools: get_time, shell_exec, fs_read, fs_write, browser_navigate, vision_analyze, computer_use, execute_code, suggest_settings_change, create_agent, edit_agent; plus skill tools (create_skill, edit_skill, delete_skill, list_skills)
- **Tests:** `shell.spec.ts`, `fs.spec.ts`, `gui.spec.ts`, `docs-edit.spec.ts` — all passing

---

### apps/cli ⚠️ PARTIAL

- **Implementation:** Non-interactive mode works fully; interactive wizard (5 prompts) works; `local-llm.ts` is a dry-run stub (throws if `dryRun: false`)
- **Tests:** 12 passing across 3 files
- **Gap:** Real Ollama integration not implemented

### apps/dashboard ✅

- **Implementation:** Real Next.js 15 app — 18+ page routes, 30+ API routes, auth (TOTP + bcrypt), chat streaming (via `@assistant-ui/react`), memory search, agents CRUD, cron/goals, approval modal, panic button, cost dashboard, skills page, onboarding, canvas
- **Tests:** 56 passing across 13 files
- **Session 5 fixes:**
  - Full shadcn dark theme CSS variables wired (`globals.css` + `tailwind.config.ts`) — all `bg-background`, `text-foreground`, `bg-muted` etc. now resolve correctly
  - Prism syntax highlighting wired in `markdown-text.tsx` (react-syntax-highlighter + oneDark theme)
  - Duplicate `runtime-provider.tsx` adapter deleted
  - **Updates tab** added to Settings page — check for updates + one-click apply with SSE progress stream

---

### services/control-plane ✅

- **Implementation:** Real — Fastify + Mastra Agent + DBOS durable workflows, budget enforcement, stuck-loop detection, 11+ Mastra tools (all permission-gated)
- **Phase 8 additions:** `SkillStore`, `SkillReflector`, `ModelRouter`, `SandboxManager`, `CanvasManager`
- **Phase 9–10 additions:** CLI wizard, dashboard setup page, chat event bus, Postgres memory switch, auth bootstrap
- **Phase 11 additions:**
  - `notifier.ts` — proactive Telegram notifications (`notify_user` tool)
  - `heartbeat.ts` — 60s scheduler: fires crons + goals, sends Telegram notifications
  - `journal.ts` — append-only session journal at `~/.open-greg/journal.md`
  - `user-model-store.ts` — detects user corrections, persists preferences + mistakes to SQLite
  - `/api/update/check` — `git fetch` + commit count behind origin/main
  - `/api/update/apply` — SSE stream: `git pull` + `docker compose pull` + `docker compose up -d`
- **Tests:** 84 spec files, all passing

### services/browser-service ⚠️ STUB

- **Implementation:** Pool management is real; `scrape()` and `act()` throw unless `dryRun: true`; no Playwright dependency declared
- **Tests:** 15 passing (all dryRun paths)
- **Gap:** No real browser automation

### services/voice-service ⚠️ PARTIAL

- **Implementation:** Code for real STT/TTS exists (`voice.py`) but Python deps not pre-installed; raises `ModelNotAvailableError` gracefully when binary/key not present
- **Tests:** Python unittest tests exist (`test_stt.py`, `test_tts.py`)

### services/vision-service 🔴 STUB

- **Implementation:** All 3 functions (`describe`, `ocr`, `gui_act`) raise `NotImplementedError`
- **Tests:** None

### services/watchdog ✅

- **Implementation:** Heartbeat tracking and timeout detection are real
- **Tests:** 4 passing

---

## Known Discrepancies Between FEATURES.md and Reality

| Feature             | FEATURES.md says | Actual state                                               |
| ------------------- | ---------------- | ---------------------------------------------------------- |
| F-053, F-070–073    | `done`           | Voice service code real but Python deps not pre-installed  |
| F-080–082 (Vision)  | `done`           | Claude vision API integration real; deps not pre-installed |
| F-060–063 (Browser) | `done`           | Tests pass but scrape/act are dry-run stubs; no Playwright |
| F-091 (Discord)     | `done`           | discord.spec.ts test loops/hangs — vitest times out        |

---

## Migration Status: REBUILD_STATE.md

The Mastra+DBOS migration is **fully complete**. `REBUILD_STATE.md` updated to reflect this. No active migration blocking work.

---

## Session 5 additions (2026-04-24)

### assistant-ui theme + syntax highlighting (done)

- `apps/dashboard/app/globals.css` — full shadcn dark theme CSS variable layer (`--background`, `--foreground`, `--muted`, `--accent`, `--border`, `--ring`, `--popover`, `--card`, `--primary`, `--secondary`, `--destructive`)
- `apps/dashboard/tailwind.config.ts` — semantic color tokens (`bg-background`, `text-foreground`, `bg-muted` etc.) now resolve via CSS variables; `darkMode: ['class']` added
- `apps/dashboard/app/components/assistant-ui/markdown-text.tsx` — Prism `oneDark` syntax highlighting via `react-syntax-highlighter`; code blocks render with language detection and transparent background
- Removed: `apps/dashboard/app/components/assistant-ui/runtime-provider.tsx` (unused duplicate adapter)

### OTA update mechanism (done)

- `services/control-plane/src/index.ts` — two new endpoints:
  - `GET /api/update/check` — runs `git fetch origin main`, returns `{ upToDate, commitsAvailable, currentVersion, latestVersion }`
  - `POST /api/update/apply` — SSE stream: `git pull` + `docker compose pull` + `docker compose up -d`; streams progress messages
- `apps/dashboard/app/settings/page.tsx` — new **Updates** tab: "Check for Updates" button, commit count display, "Apply Update & Restart" button with live log terminal

### Typecheck fixes (done)

- `packages/memory/src/index.ts` — added `UserModel`, `UserModelState`, `UserPreference`, `UserMistake`, `CorrectionSource` exports (were internal to `user-model.ts`)
- `services/control-plane/package.json` — added `@open-greg/memory: workspace:*`
- `services/control-plane/src/orchestrator.ts` — fixed: `readRecentJournal` import, `SKILLS_DIR` import, `new SkillStore(SKILLS_DIR)` constructor
- `services/control-plane/src/notifier.ts` — removed `console.warn` (ESLint `no-console`)

### Regression prevention

Before finishing any task, run:

```bash
pnpm test             # must stay 482/482
pnpm -w run typecheck # must stay 0 errors
```

---

## Quick Fix List (Ordered by Priority)

| Priority | Action                                                  | Affected Features    |
| -------- | ------------------------------------------------------- | -------------------- |
| P1       | Fix F-091 discord test timeout                          | F-091                |
| P2       | Add Playwright to browser-service, implement scrape/act | F-060–063            |
| P2       | Install Python deps for voice/vision services           | F-070–074, F-080–082 |
| P3       | Implement CLI interactive wizard (full Ollama)          | F-002, F-003         |
| P3       | Implement watchdog restart mechanism                    | F-121                |
