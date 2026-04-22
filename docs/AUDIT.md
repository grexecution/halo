# Architecture & Feature Audit

_Last updated: 2026-04-22 (session 2). Auto-maintained by agents — update this file whenever feature status changes._

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

## Test Suite Ground Truth (2026-04-22, session 2)

| Command              | Result                                                 |
| -------------------- | ------------------------------------------------------ |
| `pnpm test`          | ✅ **340/340 passing** across 75 spec files            |
| `pnpm typecheck`     | ✅ **0 errors** across all 13 packages                 |
| `pnpm test:features` | ✅ **88/88 PASS** — all missing test files now created |

---

## Feature Status Overview

**88 total features**, all marked `Status: done` in `docs/FEATURES.md`.

| Result                       | Count | Notes                                          |
| ---------------------------- | ----- | ---------------------------------------------- |
| ✅ PASS                      | 88    | All test files exist and pass                  |
| ❌ REGRESSION (missing test) | 0     | Previously 16 — all resolved in session 2      |
| ⏭️ manual:                   | 1     | F-113: 24h continuous project (manual only)    |
| 🔴 stub impl                 | ~6    | Test passes but implementation is dry-run only |

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

### packages/memory ❌ MISSING

- **Implementation:** Does not exist on disk
- **Tests:** 5 test files referenced, none exist
- **Context:** Replaced by `@mastra/memory` in control-plane. Test files were never written for the new location.

### packages/tools ❌ MISSING

- **Implementation:** Does not exist on disk (tools now live in `services/control-plane/src/mastra-tools.ts`)
- **Tests:** 4 test files referenced, none exist
- **Context:** Tools migrated to Mastra tool format during Mastra+DBOS rebuild. Tests were not created.

---

### apps/cli ⚠️ PARTIAL

- **Implementation:** Non-interactive mode works fully; interactive wizard prints "not yet implemented"; `local-llm.ts` is a dry-run stub (throws if `dryRun: false`)
- **Tests:** 12 passing across 3 files (all dry-run paths)
- **Gap:** Real Ollama integration not implemented

### apps/dashboard ✅

- **Implementation:** Real Next.js 15 app — 14 page routes, 30+ API routes, auth (TOTP + bcrypt), chat streaming, memory search, agents CRUD, cron/goals, approval modal, panic button
- **Tests:** 56 passing across 13 files (React Testing Library)
- **Notes:** `VoiceRecorder` component is simulated (uses `setTimeout` to fake transcription)

---

### services/control-plane ✅ (core) / ❌ (test coverage)

- **Implementation:** Real — Fastify + tRPC + Mastra Agent + DBOS durable workflows, budget enforcement, stuck-loop detection, 6 Mastra tools (get_time, shell_exec, fs_read, fs_write, browser_navigate, vision_describe), all permission-gated
- **Tests:** 34 passing across 6 files (main-loop, mentions, stuck, budget-session, budget-daily, timeout)
- **Missing tests:** 8 files (delegate, critic, self-health, resume, cron, goal-loop, notifications, self-diagnose)
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

| Feature                            | FEATURES.md says | Actual state                                                                                 |
| ---------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| F-030–034 (Memory)                 | `done`           | No `packages/memory` package exists; test files missing                                      |
| F-050–052, F-140 (Tools)           | `done`           | No `packages/tools` package; tools live in control-plane mastra-tools.ts; test files missing |
| F-021, F-024–026, F-110–112, F-122 | `done`           | Test files missing from control-plane                                                        |
| F-053, F-070–073, F-080–082        | `done`           | Shell scripts pass but services are NotImplementedError stubs                                |
| F-060–063 (Browser)                | `done`           | Tests pass but implementation is dry-run stub; no Playwright                                 |
| F-091 (Discord)                    | `done`           | discord.spec.ts test loops/hangs — vitest times out                                          |

---

## Open Migration: REBUILD_STATE.md

The project is mid-Mastra+DBOS migration (`REBUILD_STATE.md`, step 1 of 7 is "IN PROGRESS"). Steps remaining:

1. ⏳ Install Mastra + DBOS deps in control-plane (in progress)
2. ⬜ Wire Mastra agent into orchestrator
3. ⬜ Add DBOS durable workflows for goal-loop + cron
4. ⬜ Wire tools as Mastra tools
5. ⬜ Rewire dashboard API routes → control-plane tRPC
6. ⬜ Drop Mem0, use Mastra memory
7. ⬜ Typecheck + tests green

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

| Priority | Action                                                              | Affected Features                  |
| -------- | ------------------------------------------------------------------- | ---------------------------------- |
| P0       | Create `packages/memory/` with Mastra memory wrapper + 5 test files | F-030–034                          |
| P0       | Create `packages/tools/` with Mastra tools wrapper + 4 test files   | F-050–052, F-140                   |
| P1       | Create 8 missing control-plane test files                           | F-021, F-024–026, F-110–112, F-122 |
| P1       | Fix F-091 discord test timeout                                      | F-091                              |
| P2       | Add Playwright to browser-service, implement scrape/act             | F-060–063                          |
| P2       | Implement voice-service Python functions                            | F-070–074                          |
| P2       | Implement vision-service Python functions                           | F-080–082                          |
| P3       | Implement CLI interactive wizard                                    | F-002                              |
| P3       | Implement watchdog restart mechanism                                | F-121                              |
