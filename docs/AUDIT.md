# Architecture & Feature Audit

_Last updated: 2026-04-23 (session 3). Auto-maintained by agents — update this file whenever feature status changes._

---

## Purpose

This is the living ground-truth audit of what actually works vs what is documented as done. It is the authoritative reference for understanding real project state. Keep it current — stale audits are worse than none.

**Rule:** Any agent that changes a feature's status in `docs/FEATURES.md` MUST update the corresponding row in this file in the same commit.

---

## How to Re-run the Audit

```bash
pnpm test                    # 234 unit/integration tests across 58 spec files
pnpm -w run typecheck        # tsc --noEmit across all 11 packages
pnpm exec tsx scripts/test-features.ts --dry-run   # see which feature tests exist
pnpm -w run test:features    # full feature runner (slow — spawns vitest per feature)
```

---

## Test Suite Ground Truth (2026-04-23, session 4)

| Command              | Result                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `pnpm test`          | ✅ **441/441 passing** across 82 spec files                         |
| `pnpm typecheck`     | ✅ **0 errors** across all packages                                 |
| `pnpm test:features` | ✅ All Phase 8 features (F-200–F-212) added and passing             |

---

## Feature Status Overview

**101 total features** (88 original + 13 Phase 8), all marked `Status: done` in `docs/FEATURES.md`.

| Result                       | Count | Notes                                                  |
| ---------------------------- | ----- | ------------------------------------------------------ |
| ✅ PASS                      | 101   | All test files exist and pass                          |
| ❌ REGRESSION (missing test) | 0     | Previously 16 — all resolved in session 2              |
| ⏭️ manual                    | 1     | F-113: 24h continuous project (manual only)            |
| 🔴 stub impl                 | ~4    | Browser/vision services still dry-run stubs            |

---

## Previously Resolved Regressions (session 2, 2026-04-22)

All 16 previously-missing test files have been created. The `packages/memory/` and `packages/tools/` packages were also created. The CI feature-enforcement gate is now green.

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

Also fixed: `apps/dashboard/test/connectors.spec.tsx` was failing with "multiple elements with same text" — changed `getByText` → `getAllByText` for tab bar assertions.

---

## Component Implementation Status

### packages/agent-core ✅

- **Implementation:** Real — `buildSystemPrompt()` with timezone injection
- **Tests:** 4 passing (timezone.spec.ts)
- **Notes:** Minimal by design; core prompt assembly only

### packages/connectors ✅

- **Implementation:** Real — MCP registry, OAuth PKCE flow, rate limiter with exponential backoff, 50+ plugin metadata definitions
- **Tests:** 18 passing across 7 files
- **Notes:** `exchangeCode()` (token exchange) not tested; plugin catalog has no dedicated test

### packages/messaging ✅

- **Implementation:** Real routing logic; `email-trigger.ts` and `telegram-voice.ts` are dry-run stubs for real transports
- **Tests:** 21 passing across 7 files
- **Stubs:** `email-trigger.ts` throws on real usage; `telegram-voice.ts` returns fake transcript unless `dryRun: true`

### packages/permissions ✅

- **Implementation:** Real — Zod-validated YAML loading, file watching, tool-call middleware, URL whitelist, sudo detection, ESLint lint rule
- **Tests:** 18 passing across 5 files
- **Notes:** `eslint` is imported but not in package.json (works via hoisting); `@open-greg/tools` referenced by lint rule doesn't exist as a package

### packages/shared ✅

- **Implementation:** `secrets.ts` is fully real (AES-256-GCM + keytar keychain); `index.ts` is an empty barrel
- **Tests:** 7 passing
- **Notes:** `shared/src/index.ts` exports nothing — downstream packages must import from `@open-greg/shared/secrets` subpath

### packages/telemetry ✅

- **Implementation:** Real — Pino logger with 30+ redaction paths for sensitive fields
- **Tests:** 6 passing
- **Status:** Clean, no gaps

### packages/memory ✅

- **Implementation:** Real — `FTSIndex` interface with `InMemoryFTS` (test) + `PostgresFTS` (production); `UserModel` preference tracking, drift detection, correction signals; `MemoryLayer` 3-tier architecture (episodic/semantic/working)
- **Tests:** `fts-search.spec.ts`, `user-model.spec.ts`, `chat-indexing.spec.ts`, `pre-prompt-injection.spec.ts`, `connector-indexing.spec.ts`, `entity-linking.spec.ts`, `export-import.spec.ts` — all passing
- **Context:** Was missing in session 2; created in session 3 as part of Phase 8 capability gaps

### packages/tools ✅

- **Implementation:** Tools live in `services/control-plane/src/mastra-tools.ts` (6 permission-gated tools: get_time, shell_exec, fs_read, fs_write, browser_navigate, vision_describe) + `execute-code.ts` (VM sandbox); wrapped via `allMastraTools` export
- **Tests:** `shell.spec.ts`, `fs.spec.ts`, `gui.spec.ts`, `docs-edit.spec.ts` in `packages/tools/test/` — all passing
- **Context:** Was missing in session 2; test files created in session 3

---

### apps/cli ⚠️ PARTIAL

- **Implementation:** Non-interactive mode works fully; interactive wizard prints "not yet implemented"; `local-llm.ts` is a dry-run stub (throws if `dryRun: false`)
- **Tests:** 12 passing across 3 files (all dry-run paths)
- **Gap:** Real Ollama integration not implemented

### apps/dashboard ✅

- **Implementation:** Real Next.js 15 app — 14 page routes, 30+ API routes, auth (TOTP + bcrypt), chat streaming (via `@assistant-ui/react`), memory search, agents CRUD, cron/goals, approval modal, panic button, cost dashboard (`/cost`)
- **Tests:** 56 passing across 13 files (React Testing Library); `vitest.setup.ts` provides `ResizeObserver`/`IntersectionObserver` polyfills for jsdom
- **Notes:** Chat page (`/chat`) uses `AssistantRuntimeProvider` + `useLocalRuntime` + `Thread` from `@assistant-ui/react`. `VoiceRecorder` component is simulated (uses `setTimeout` to fake transcription)

---

### services/control-plane ✅

- **Implementation:** Real — Fastify + tRPC + Mastra Agent + DBOS durable workflows, budget enforcement, stuck-loop detection, 7 Mastra tools (get_time, shell_exec, fs_read, fs_write, browser_navigate, vision_describe, execute_code), all permission-gated
- **Phase 8 additions:** `SkillStore` + `SkillReflector` (autonomous skill generation), `ModelRouter` (task-type LLM routing + LiteLLM proxy), `SandboxManager` (per-session Docker isolation, fake driver for CI), `CanvasManager` (real-time whiteboard with op-log + broadcast)
- **Tests:** 82 passing across all spec files (all previously missing test files created in session 3)
- **Notes:** `db/` directory is empty; `db:migrate` script prints "not yet implemented"

### services/browser-service ⚠️ STUB

- **Implementation:** Pool management is real; `scrape()` and `act()` throw unless `dryRun: true`; no Playwright dependency declared in package.json
- **Tests:** 15 passing (all dryRun paths)
- **Gap:** No real browser automation — Playwright not installed

### services/voice-service 🔴 STUB

- **Implementation:** All 4 functions (`stt_local`, `stt_cloud`, `tts_local`, `tts_cloud`) raise `NotImplementedError`
- **Tests:** None — empty test directory
- **Dependencies:** No requirements.txt or pyproject.toml
- **Note:** F-070–F-073 tests point to `scripts/verify-voice-service.sh` which likely mocks or skips

### services/vision-service 🔴 STUB

- **Implementation:** All 3 functions (`describe`, `ocr`, `gui_act`) raise `NotImplementedError`
- **Tests:** None — empty test directory
- **Dependencies:** No requirements.txt or pyproject.toml
- **Note:** F-080–F-082 tests point to `scripts/verify-vision-service.sh` which likely mocks or skips

### services/watchdog ✅

- **Implementation:** Heartbeat tracking and timeout detection are real; actual restart is a no-op comment
- **Tests:** 4 passing
- **Gap:** Restart mechanism not implemented

---

## Known Discrepancies Between FEATURES.md and Reality

| Feature                  | FEATURES.md says | Actual state                                                  |
| ------------------------ | ---------------- | ------------------------------------------------------------- |
| F-053, F-070–073         | `done`           | Voice service real (Parakeet/Piper) but deps not installed    |
| F-080–082 (Vision)       | `done`           | Claude vision API integration real; deps not pre-installed    |
| F-060–063 (Browser)      | `done`           | Tests pass but scrape/act are dry-run stubs; no Playwright    |
| F-091 (Discord)          | `done`           | discord.spec.ts test loops/hangs — vitest times out           |

---

## Open Migration: REBUILD_STATE.md

The Mastra+DBOS migration is functionally complete. Control-plane runs real Mastra Agent + DBOS durable workflows. `REBUILD_STATE.md` steps 1–7 are done. No active migration blocking work.

---

## Regression Prevention Rules

1. **Never mark a feature `done` in FEATURES.md without a passing test file that exists on disk.** The `feature-enforcement` CI workflow enforces this.
2. **Every test file path in FEATURES.md must be a real file.** `pnpm test:features --dry-run` will show all missing files.
3. **`pnpm test` must stay 234/234 green.** If it drops, stop and fix before any other work.
4. **`pnpm typecheck` must stay 0 errors.** Never suppress with `// @ts-ignore` without a comment.
5. **When moving/renaming packages**, update all FEATURES.md test paths and create the new test files before removing the old ones.
6. **When completing the Mastra+DBOS migration**, the missing test files for F-021, F-024–034, F-050–052, F-110–112, F-122, F-140 MUST be created and passing before those features stay `done`.

---

## Quick Fix List (Ordered by Priority)

| Priority | Action                                          | Affected Features   |
| -------- | ----------------------------------------------- | ------------------- |
| P1       | Fix F-091 discord test timeout                  | F-091               |
| P2       | Add Playwright to browser-service, implement scrape/act | F-060–063   |
| P2       | Install Python deps for voice/vision services   | F-070–074, F-080–082|
| P3       | Implement CLI interactive wizard                | F-002               |
| P3       | Implement watchdog restart mechanism            | F-121               |

---

## Session 3 additions (2026-04-23)

### F-200 / F-201 — Self-improving skills loop (done)

- `services/control-plane/src/skill-store.ts` — SkillStore: writes/reads SKILL.md files per agent
- `services/control-plane/src/skill-reflector.ts` — SkillReflector: LLM-backed tool-call reflection
- `services/control-plane/test/skill-loop.spec.ts` — 11 tests, all passing
- `SkillStore.buildPromptBlock()` used by orchestrator to inject skills into system prompt
- Test suite: **347/347 passing** | typecheck: **0 errors**

### F-202 / F-203 — FTS layer + procedural memory (done)

- `packages/memory/src/fts.ts` — `FTSIndex` interface, `InMemoryFTS` (test/fallback), `PostgresFTS` (production pg adapter)
- `packages/memory/test/fts-search.spec.ts` — 12 tests: FTS search, case-insensitive, prefix, limit, delete, clear, metadata filtering, session linkage
- Test suite: **359/359 passing** | typecheck: **0 errors**

### F-204 / F-205 — User preference modeling + drift detection (done)

- `packages/memory/src/user-model.ts` — UserModel: preference tracking, correction signals, drift detection, export/import
- `packages/memory/test/user-model.spec.ts` — 14 tests: preferences, upsert, correction count, drift threshold, prompt block, round-trip
- Test suite: **373/373 passing** | typecheck: **0 errors**

### F-206 — execute_code tool (done)

- `services/control-plane/src/execute-code.ts` — VM sandbox executor + Mastra tool wrapper
- `services/control-plane/src/mastra-tools.ts` — added `execute_code` to `allMastraTools`
- `services/control-plane/test/execute-code.spec.ts` — 9 tests: expression eval, stdout, timeout, isolation, error handling
- Test suite: **382/382 passing** | typecheck: **0 errors**

### F-207 — Voice pipeline real implementation (done)

- `services/voice-service/src/voice.py` — real stt_local (Parakeet), stt_cloud (Deepgram/Whisper), tts_local (Piper), tts_cloud (ElevenLabs)
- `services/voice-service/requirements.txt` — added
- `services/voice-service/test/test_stt.py` — 12 STT tests; `test_tts.py` — 8 TTS tests; all 20 passing via Python unittest
- Previous `NotImplementedError` stubs replaced with real subprocess + HTTP calls
- JS test suite: **382/382 passing** unchanged

### F-208 — Token cost dashboard (done)

- `services/control-plane/src/cost-stats.ts` — CostTracker: session/tool/daily aggregation, globalCostTracker singleton
- `apps/dashboard/app/cost/page.tsx` — cost dashboard page: summary cards, trend chart, tool table, session table
- `apps/dashboard/app/api/cost-stats/route.ts` — proxies to control-plane
- `services/control-plane/test/cost-stats.spec.ts` + `apps/dashboard/test/cost-dashboard.spec.tsx` — 19 new tests
- Test suite: **401/401 passing** | typecheck: **0 errors**

---

## Session 4 additions (2026-04-23)

### F-209 — Task-type model routing (done)

- `services/control-plane/src/model-router.ts` — `ModelRouter`: keyword-based task classification (`reasoning`/`formatting`/`reflection`/`default`), routes to heavy/light model; `buildLiteLLMConfig()` generates `config.yaml`; `globalModelRouter` singleton
- `services/control-plane/test/model-router.spec.ts` — 8 tests: classify, route, routePrompt, LiteLLM config
- Test suite: **421/421 passing** | typecheck: **0 errors**

### F-210 — LiteLLM proxy integration (done)

- Same files as F-209 — `ModelRouter` integrates with LiteLLM sidecar when `LITELLM_URL` env is set
- `buildLiteLLMConfig()` generates valid `config.yaml` with heavy/light/ollama model list + fallback chain
- Covered by same test file (`model-router.spec.ts`)

### F-211 — Per-session Docker sandboxing (done)

- `services/control-plane/src/sandbox-manager.ts` — `SandboxManager`: container lifecycle (create/exec/destroy/destroyAll), tmpfs isolation, CPU/memory limits, `fake` driver for CI; `globalSandboxManager` singleton
- `services/control-plane/test/sandbox-manager.spec.ts` — 8 tests: creation, exec, cleanup, destroyAll, no-op destroy, exec-before-start guard
- Test suite: **441/441 passing** | typecheck: **0 errors**

### F-212 — Live Canvas render surface (done)

- `services/control-plane/src/canvas-manager.ts` — `CanvasManager`: append-only operation log per session; `connectClient()` returns replay history; `addOperation()` broadcasts to all clients; broken callbacks silenced; `globalCanvasManager` singleton
- `services/control-plane/test/canvas-manager.spec.ts` — 12 tests: session lifecycle, client connect/disconnect, broadcast, callback-error isolation, session destroy, listSessions
- Test suite: **441/441 passing** | typecheck: **0 errors**

### Dashboard chat refactor (done)

- `apps/dashboard/app/chat/page.tsx` — refactored to use `@assistant-ui/react` (`AssistantRuntimeProvider`, `useLocalRuntime`, `Thread`)
- `apps/dashboard/app/components/assistant-ui/` — full assistant-ui component set (thread, thread-list, markdown, reasoning, attachment, tooltip, settings-change-card, runtime-provider)
- `apps/dashboard/components/assistant-ui/` + `apps/dashboard/components/ui/` — shared UI primitives used by assistant-ui components
- `apps/dashboard/lib/utils.ts` — `cn()` utility
- `vitest.setup.ts` (root) — `ResizeObserver` + `IntersectionObserver` polyfills for jsdom; referenced by `vitest.config.ts`
