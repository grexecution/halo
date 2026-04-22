# Features & Testing Guide

> _What exists, what must always be tested, and exactly how to test it during development._
>
> Authoritative feature specs live in `docs/FEATURES.md`. Authoritative testing rules in `docs/TESTING.md`.
> This file is the developer-facing summary: what to run, when, and why.

---

## The non-negotiable rule

**Every feature marked `done` in `docs/FEATURES.md` must have a passing test in the same commit.**

CI blocks merges that violate this (F-160). `pnpm test:features` is the regression safety net — if it was green before your change and red after, you broke something.

---

## Testing tiers

| Tier            | When to run             | What it covers                                                 | Command                                        |
| --------------- | ----------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| **Unit**        | On every save           | Single function/class, pure logic, no I/O                      | `pnpm test`                                    |
| **Integration** | On every PR             | Cross-module, real DB (testcontainers), real Redis, mocked LLM | `pnpm test` (CI runs this)                     |
| **Feature**     | Before release, nightly | Full feature acceptance criteria, one file per F-NNN           | `pnpm test:features`                           |
| **Security**    | On every PR + nightly   | Permission bypass, sudo, panic, URL whitelist                  | `pnpm test:features` (includes security suite) |
| **Manual**      | Before releases         | 24h autonomy runs, OAuth flows, hardware-specific voice        | Checklist in `docs/MANUAL_TESTS.md`            |

---

## What to run during development

### Minimum bar for any code change

```bash
pnpm lint                  # zero warnings tolerated
pnpm typecheck             # zero type errors
pnpm test                  # unit + integration
```

### Before opening a PR

```bash
pnpm lint && pnpm typecheck && pnpm test
# If your change touches a feature: also run
pnpm test:features
```

### Before merging to main / declaring a phase complete

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:features
# Must be green with zero regressions
```

### Checking production readiness

```bash
pnpm readiness-check       # F-170 — runs full checklist, outputs READY or NOT READY
```

---

## Features that are ALWAYS tested (security-critical)

These must never regress. The security regression suite (`test/security-regression/`) runs on every PR:

| Feature                             | What is tested                                                               | Test file                                            |
| ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| **F-041** Tool-call middleware      | Every tool call routes through `check()`. Bypassing it is detectable.        | `packages/permissions/test/middleware.spec.ts`       |
| **F-042** URL whitelist             | Non-whitelisted domains are denied when whitelist mode is on.                | `packages/permissions/test/url-whitelist.spec.ts`    |
| **F-043** Sudo toggle               | `sudo ls` is denied when `filesystem.sudo=false`.                            | `packages/permissions/test/sudo.spec.ts`             |
| **F-044** Panic button              | All in-flight tool calls stop within 2s of panic.                            | `apps/dashboard/test/panic.spec.tsx`                 |
| **F-045** No-bypass lint rule       | Direct tool handler calls that skip middleware fail CI.                      | `packages/permissions/test/lint-rule.spec.ts`        |
| **F-130** Session budget            | Session aborts when `max_tokens` / `max_cost_usd` is hit.                    | `services/control-plane/test/budget-session.spec.ts` |
| **F-131** Daily spend cap           | New sessions are blocked at 100% of daily cap.                               | `services/control-plane/test/budget-daily.spec.ts`   |
| **F-135** Secrets storage           | No plaintext secret survives to disk. Keychain round-trip works.             | `packages/shared/test/secrets.spec.ts`               |
| **F-136** Log redaction             | API keys in log lines appear as `***REDACTED***`.                            | `packages/telemetry/test/redaction.spec.ts`          |
| **F-167** Security regression suite | Aggregated: denied paths, sudo, panic, whitelist, non-bypassable middleware. | `test/security-regression/security.spec.ts`          |

**If any of these fail: STOP. Do not work around. Fix the regression or escalate.**

---

## Feature list by category

### Install & onboarding (Phase 1)

| ID    | Feature                                        | Test path                          |
| ----- | ---------------------------------------------- | ---------------------------------- |
| F-001 | `npx create-open-greg init` bootstrap          | `apps/cli/test/bootstrap.e2e.ts`   |
| F-002 | CLI wizard (LLM, messaging, MCPs, permissions) | `apps/cli/test/wizard.spec.ts`     |
| F-003 | Local LLM one-click install (3 tiers)          | `apps/cli/test/local-llm.spec.ts`  |
| F-004 | Docker Compose lifecycle                       | `scripts/test-docker-lifecycle.sh` |

### Dashboard UI (Phase 2–6)

| ID    | Feature                                       | Test path                                     |
| ----- | --------------------------------------------- | --------------------------------------------- |
| F-010 | Chat page with token streaming                | `apps/dashboard/test/chat.spec.tsx`           |
| F-011 | Sub-agent tabs                                | `apps/dashboard/test/subagent-tabs.spec.tsx`  |
| F-012 | Agents CRUD page                              | `apps/dashboard/test/agents-crud.spec.tsx`    |
| F-013 | Connectors page + OAuth UI                    | `apps/dashboard/test/connectors.spec.tsx`     |
| F-014 | Memory browser (search, entity graph, delete) | `apps/dashboard/test/memory-browser.spec.tsx` |
| F-015 | Cron & Goals page                             | `apps/dashboard/test/cron-goals.spec.tsx`     |
| F-016 | Logs viewer (filter by agent/tool/trace/time) | `apps/dashboard/test/logs.spec.tsx`           |
| F-017 | Registry overview page                        | `apps/dashboard/test/registry.spec.tsx`       |
| F-018 | Settings page (permissions + telemetry)       | `apps/dashboard/test/settings.spec.tsx`       |
| F-019 | Voice in/out on dashboard                     | `apps/dashboard/test/voice.spec.tsx`          |

### Agent core (Phase 2–5)

| ID    | Feature                            | Test path                                             |
| ----- | ---------------------------------- | ----------------------------------------------------- |
| F-020 | Main agent loop (message → stream) | `services/control-plane/test/main-loop.spec.ts`       |
| F-021 | Sub-agent delegation               | `services/control-plane/test/sub-agent.spec.ts`       |
| F-022 | Critic sub-agent                   | `services/control-plane/test/critic.spec.ts`          |
| F-023 | Messaging @handle routing          | `packages/messaging/test/handle-routing.spec.ts`      |
| F-024 | Multi-turn context                 | `services/control-plane/test/multi-turn.spec.ts`      |
| F-025 | Session restore after restart      | `services/control-plane/test/session-restore.spec.ts` |
| F-026 | LLM provider switching             | `packages/agent-core/test/provider-switch.spec.ts`    |

### Memory (Phase 2–4)

| ID    | Feature                                     | Test path                                     |
| ----- | ------------------------------------------- | --------------------------------------------- |
| F-030 | Memory indexing (every turn)                | `packages/memory/test/indexing.spec.ts`       |
| F-031 | Implicit memory retrieval (pre-turn inject) | `packages/memory/test/retrieval.spec.ts`      |
| F-032 | Connector pull indexing                     | `packages/memory/test/connector-pull.spec.ts` |
| F-033 | Cross-connector entity linking              | `packages/memory/test/entity-linking.spec.ts` |
| F-034 | Memory export/import round-trip             | `packages/memory/test/export-import.spec.ts`  |

### Permissions (Phase 2–4) — see also security section above

| ID    | Feature                             | Test path                                         |
| ----- | ----------------------------------- | ------------------------------------------------- |
| F-040 | YAML loading + hot-reload           | `packages/permissions/test/yaml-loading.spec.ts`  |
| F-041 | Tool-call middleware                | `packages/permissions/test/middleware.spec.ts`    |
| F-042 | URL whitelist mode                  | `packages/permissions/test/url-whitelist.spec.ts` |
| F-043 | Sudo toggle                         | `packages/permissions/test/sudo.spec.ts`          |
| F-044 | Panic button                        | `apps/dashboard/test/panic.spec.tsx`              |
| F-045 | Non-bypassable middleware lint rule | `packages/permissions/test/lint-rule.spec.ts`     |

### Computer control (Phase 4)

| ID    | Feature                                         | Test path                           |
| ----- | ----------------------------------------------- | ----------------------------------- |
| F-050 | `shell.exec` with path permission checks        | `packages/tools/test/shell.spec.ts` |
| F-051 | `fs.read` / `fs.write` with allowed-path checks | `packages/tools/test/fs.spec.ts`    |
| F-052 | Desktop GUI — Anthropic computer-use            | `packages/tools/test/gui.spec.ts`   |
| F-053 | Desktop GUI — local fallback (pyautogui + VLM)  | `scripts/verify-vision-service.sh`  |

### Browser (Phase 4)

| ID    | Feature                           | Test path                                          |
| ----- | --------------------------------- | -------------------------------------------------- |
| F-060 | Scraping mode                     | `services/browser-service/test/scrape.spec.ts`     |
| F-061 | Headless-agent mode (vision loop) | `services/browser-service/test/act.spec.ts`        |
| F-062 | Persistent browser profile        | `services/browser-service/test/persistent.spec.ts` |
| F-063 | Browser pool management           | `services/browser-service/test/pool.spec.ts`       |

### Voice (Phase 6)

| ID    | Feature                                  | Test path                                       |
| ----- | ---------------------------------------- | ----------------------------------------------- |
| F-070 | Local STT (Parakeet v3)                  | `scripts/verify-voice-service.sh`               |
| F-071 | Cloud STT (Deepgram / Whisper)           | `scripts/verify-voice-service.sh`               |
| F-072 | Local TTS (Piper)                        | `scripts/verify-voice-service.sh`               |
| F-073 | Cloud TTS (ElevenLabs)                   | `scripts/verify-voice-service.sh`               |
| F-074 | Language auto-detection + Telegram voice | `packages/messaging/test/voice-routing.spec.ts` |

### Messaging (Phase 3)

| ID    | Feature                                          | Test path                                  |
| ----- | ------------------------------------------------ | ------------------------------------------ |
| F-090 | Telegram bot (long polling, group chats)         | `packages/messaging/test/telegram.spec.ts` |
| F-091 | Discord bot                                      | `packages/messaging/test/discord.spec.ts`  |
| F-092 | Slack bot                                        | `packages/messaging/test/slack.spec.ts`    |
| F-093 | Email trigger (Gmail label polling + SMTP reply) | `packages/messaging/test/email.spec.ts`    |

### Connectors / MCP (Phase 3)

| ID    | Feature                           | Test path                                        |
| ----- | --------------------------------- | ------------------------------------------------ |
| F-100 | MCP client registry               | `packages/connectors/test/registry.spec.ts`      |
| F-101 | OAuth flow framework              | `packages/connectors/test/oauth.spec.ts`         |
| F-102 | Gmail connector                   | `packages/connectors/test/gmail.spec.ts`         |
| F-103 | GitHub connector                  | `packages/connectors/test/github.spec.ts`        |
| F-104 | Google Calendar connector         | `packages/connectors/test/calendar.spec.ts`      |
| F-105 | Custom MCP add                    | `packages/connectors/test/custom.spec.ts`        |
| F-106 | Browser-automation skill recorder | `services/browser-service/test/recorder.spec.ts` |

### Autonomy (Phase 5)

| ID    | Feature                       | Test path                                           |
| ----- | ----------------------------- | --------------------------------------------------- |
| F-110 | Cron scheduler (BullMQ)       | `services/control-plane/test/cron.spec.ts`          |
| F-111 | Goal loop worker              | `services/control-plane/test/goal-loop.spec.ts`     |
| F-112 | Notification routing          | `services/control-plane/test/notifications.spec.ts` |
| F-113 | Continuous project mode (24h) | `manual:continuous-project-24h`                     |

### Crash resilience (Phase 1 + 5)

| ID    | Feature                       | Test path                                           |
| ----- | ----------------------------- | --------------------------------------------------- |
| F-120 | Docker restart policies       | `scripts/test-restart.sh`                           |
| F-121 | Watchdog heartbeats + restart | `services/watchdog/test/watchdog.spec.ts`           |
| F-122 | Agent self-diagnose tools     | `services/control-plane/test/self-diagnose.spec.ts` |

### Safety & cost controls (Phase 2 + 4)

| ID    | Feature                        | Test path                                            |
| ----- | ------------------------------ | ---------------------------------------------------- |
| F-130 | Per-session budget enforcement | `services/control-plane/test/budget-session.spec.ts` |
| F-131 | Daily spend cap                | `services/control-plane/test/budget-daily.spec.ts`   |
| F-132 | Approval flow — dashboard      | `apps/dashboard/test/approval.spec.tsx`              |
| F-133 | Approval flow — Telegram       | `packages/messaging/test/telegram-approval.spec.ts`  |
| F-134 | Tool timeouts                  | `services/control-plane/test/timeout.spec.ts`        |

### Secrets, logging, observability (Phase 1–2)

| ID    | Feature                            | Test path                                     |
| ----- | ---------------------------------- | --------------------------------------------- |
| F-135 | Keychain with headless fallback    | `packages/shared/test/secrets.spec.ts`        |
| F-136 | Pino secret redaction              | `packages/telemetry/test/redaction.spec.ts`   |
| F-137 | Rate-limit backoff (external APIs) | `packages/connectors/test/rate-limit.spec.ts` |
| F-150 | Timezone in agent prompts          | `packages/agent-core/test/timezone.spec.ts`   |

### Agent self-management (Phase 5)

| ID    | Feature                                      | Test path                                   |
| ----- | -------------------------------------------- | ------------------------------------------- |
| F-140 | Agent edits own docs (git commit with trace) | `packages/tools/test/docs-edit.spec.ts`     |
| F-141 | Stuck-loop detector                          | `services/control-plane/test/stuck.spec.ts` |

### CI / self-repair infrastructure (Phase 1–2)

| ID    | Feature                                   | Test path                                   |
| ----- | ----------------------------------------- | ------------------------------------------- |
| F-160 | Feature-test CI enforcement               | `scripts/test-features.spec.ts`             |
| F-161 | STUCK.md escalation CI check              | `scripts/test-stuck-enforcement.sh`         |
| F-162 | Regression detection                      | `scripts/test-regression-detector.spec.ts`  |
| F-163 | Nightly regression build                  | `scripts/verify-nightly.sh`                 |
| F-164 | Build-health dashboard page               | `apps/dashboard/test/build-health.spec.tsx` |
| F-165 | Bounded auto-retry for flaky tests        | `scripts/test-flake-detection.spec.ts`      |
| F-166 | Pre-commit hook bundle (husky + gitleaks) | `scripts/test-precommit.sh`                 |
| F-167 | Security regression suite                 | `test/security-regression/security.spec.ts` |
| F-168 | Fail-fast rescue branch                   | `scripts/test-rescue-flow.sh`               |
| F-169 | Cost tracking per build session           | `scripts/test-cost-tracking.spec.ts`        |
| F-170 | Production readiness checklist command    | `scripts/test-readiness-check.spec.ts`      |

---

## How to write a feature test

1. **One file per feature ID.** File name must contain the ID (e.g. `f-020-main-loop.spec.ts`).
2. **Outer describe matches ID:** `describe('F-020: Main agent loop', () => { ... })`.
3. **Assert acceptance criteria verbatim** from `docs/FEATURES.md` — not implementation details.
4. **No real LLM in default runs.** Gate on `INTEGRATION=1`:
   ```ts
   const it = process.env.INTEGRATION ? test : test.skip
   ```
5. **Use test utilities:**
   - `@open-greg/shared/testing/mock-llm` — deterministic LLM responses.
   - `packages/connectors/testing/mock-mcp` — fake MCP server.
   - `@sinonjs/fake-timers` — for cron/goal tests.
   - testcontainers — real Postgres/Redis for integration tests.
6. **Never assert exact LLM text.** Assert tool calls made, structured fields, or regex match.
7. **Add the test path to `docs/FEATURES.md`** in the same commit as the implementation.

---

## How `pnpm test:features` works

`scripts/test-features.ts`:

1. Parses `docs/FEATURES.md` with regex.
2. Finds every row with `Status: done` and extracts `Test: <path>`.
3. Runs each test. Compares against `artifacts/feature-history.jsonl` to flag regressions.
4. Prints: `N/M features passing` — split into passes, new failures, regressions.
5. Exits non-zero if any fail. Appends results to history.

**Regression label:** a feature that was passing and now fails prints `REGRESSION: F-NNN` — not just `FAIL`. Track regressions separately.

---

## Mock strategy quick-reference

| Need                   | Use                                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| Deterministic LLM      | `import { mockLLM } from '@open-greg/shared/testing/mock-llm'`         |
| Fake MCP server        | `import { MockMCPServer } from 'packages/connectors/testing/mock-mcp'` |
| Fake time (cron/goals) | `import { useFakeTimers } from '@sinonjs/fake-timers'`                 |
| In-memory filesystem   | `memfs` for unit tests, real `tmp` dir for integration                 |
| Real Postgres/Redis    | `testcontainers` — spun up per test suite                              |
| Playwright replay      | Use recorded traces in `artifacts/`                                    |

---

## What "done" means

A feature is `done` when:

- [ ] Code implements all acceptance criteria from `docs/FEATURES.md`.
- [ ] Test file exists at the path listed in `docs/FEATURES.md`.
- [ ] `pnpm test:features` is green including that feature.
- [ ] `pnpm lint && pnpm typecheck` pass.
- [ ] All previously-passing features still pass (no regressions).
- [ ] `docs/FEATURES.md` status updated to `done` in the same commit.

---

_End of FEATURES_AND_TESTING.md_
