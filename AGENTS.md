# AGENTS.md

_This is the entry point for any AI coding agent working on this repository. Read this file first. Follow the pointers below as needed. Do not load everything at once — each doc is self-contained._

> **Note:** `CLAUDE.md` is a symlink to this file. Same rules apply to Claude Code, Codex, Cursor, Aider, Windsurf, etc.

---

## 1. What this project is

**Working name:** `open-greg` (see `docs/OPEN_DECISIONS.md`).

An open-source, self-hosted, autonomous AI agent platform. It is the OpenClaw replacement that doesn't crash, has real memory, granular permissions, and actually does autonomous work.

**Target user:** one technical person (developer, agency owner, power user) running it on their own Mac Mini or Linux box.

**Distribution:** single npm package. `npx create-open-greg init` → wizard → running system. Docker Compose runs under the hood; the user never types `docker`.

---

## 2. Documentation map — read on demand

Do not read all of these at once. Read the one(s) relevant to your current task.

| File                      | When to read it                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md`    | Before any cross-service change. Full system architecture.                                                                          |
| `docs/FEATURES.md`        | Before adding, modifying, or testing any feature. Feature registry + tests.                                                         |
| `docs/PHASES.md`          | Before starting work. The build plan, day-by-day.                                                                                   |
| `docs/CONVENTIONS.md`     | Before writing code. Style, naming, patterns.                                                                                       |
| `docs/DATA_MODEL.md`      | Before any DB change. Schema + migrations policy.                                                                                   |
| `docs/PERMISSIONS.md`     | Before touching anything that calls a tool. Security model.                                                                         |
| `docs/CONNECTORS.md`      | When adding an MCP, LLM, or external service.                                                                                       |
| `docs/AGENTS_INTERNAL.md` | When working on the agent orchestrator or sub-agents.                                                                               |
| `docs/TESTING.md`         | Before finishing any task. What to test, how to test it.                                                                            |
| `docs/SELF_REPAIR.md`     | **Before starting any phase.** The bounded-iteration rules for self-repair and self-test. Read this to know when to STOP iterating. |
| `docs/RUNBOOK.md`         | **When something breaks.** Known failure modes + recovery. Check before asking for help.                                            |
| `docs/OPEN_DECISIONS.md`  | Unresolved questions. Check before making big assumptions.                                                                          |
| `BUILD_PROMPT.md`         | The master prompt to run the full build end-to-end.                                                                                 |

---

## 3. Golden rules (never violate)

1. **Don't invent what exists.** Every hard problem in this repo is solved by a library. Glue, don't rebuild.
2. **Every tool call goes through the permission middleware.** No exceptions. See `docs/PERMISSIONS.md`.
3. **State lives in Postgres.** Never in-process. Restart must equal resume.
4. **No plaintext secrets on disk.** Use the OS keychain via `keytar`. Ever.
5. **Every feature in `docs/FEATURES.md` has a test.** If you add a feature, add its test row. If you break a test, stop and fix before continuing.
6. **Update the relevant doc when you change behavior.** If architecture changes, edit `docs/ARCHITECTURE.md` in the same commit. Stale docs are worse than no docs.
7. **Cross-reference before adding.** Before adding a new feature, grep `docs/FEATURES.md` for overlap. Don't duplicate.
8. **Bounded iteration.** Max 5 attempts on a failing test, max 3 on a phase gate. On timeout: write `STUCK.md` and escalate. See `docs/SELF_REPAIR.md`. Never mark a feature `done` without a passing test in the same commit.
9. **Fail fast on safety regressions.** Security tests, permission bypasses, deleted migrations, committed secrets, broken budget enforcement — STOP, do not work around, escalate immediately. See `docs/SELF_REPAIR.md#8`.

---

## 4. Stack (fixed — do not propose alternatives without a reason)

- **Runtime:** Node 22 LTS + pnpm workspaces
- **API:** Fastify + tRPC
- **Frontend:** Next.js 15 App Router + shadcn/ui + Tailwind + assistant-ui
- **DB:** Postgres 16 with pgvector
- **Queue:** BullMQ on Redis
- **Agent SDK:** Vercel AI SDK **v6** with built-in MCP (`@ai-sdk/mcp`, stable, not experimental)
- **Memory:** Mem0 OpenMemory (default), Hindsight (swappable)
- **Browser:** Playwright (3 modes — see `docs/ARCHITECTURE.md#browser`)
- **Computer use:** Anthropic computer-use tool (primary), pyautogui (local-LLM fallback)
- **Local LLM:** Ollama
- **STT:** Parakeet-tdt-0.6b-v3 (local), Whisper/Deepgram (cloud)
- **TTS:** Piper (local), ElevenLabs (cloud)
- **Messaging:** grammy (Telegram), discord.js, @slack/bolt
- **Observability:** OpenTelemetry → optional SigNoz export
- **Secrets:** OS keychain via `keytar`. On headless Linux without libsecret/gnome-keyring, falls back to AES-256-encrypted file at `~/.open-greg/secrets.enc` with passphrase from `GREG_SECRET_PASSPHRASE` env var (see `docs/PERMISSIONS.md#secrets-storage`).

Full rationale in `docs/ARCHITECTURE.md`.

---

## 5. Common commands

```bash
# From repo root (pnpm workspace)
# NOTE: pnpm v10 workspace roots require -w flag for root scripts.
pnpm install                      # install all workspace deps
pnpm -w run dev                   # run everything (dashboard + control plane + services)
pnpm -w run dev:dashboard         # dashboard only
pnpm -w run dev:control-plane     # control plane only
pnpm -w run test                  # run all tests
pnpm -w run test:features         # run the FEATURES.md feature-test matrix
pnpm -w run lint                  # lint all packages
pnpm -w run typecheck             # tsc --noEmit across all packages
pnpm -w run db:migrate            # drizzle migrations
pnpm -w run db:seed               # seed dev data
pnpm -w run docker:up             # start Postgres/Redis/Ollama/Mem0 containers
pnpm -w run docker:down           # stop them

# From apps/cli
pnpm --filter create-open-greg build  # build the npm package
pnpm --filter create-open-greg link   # link it locally for testing the init flow
```

---

## 6. Workflow for AI agents

**This project uses strict TDD with bounded self-repair. Read `docs/SELF_REPAIR.md` before starting.**

Before you touch code:

1. Read the **task**. Identify the minimum set of docs to read — use the table in section 2.
2. Grep `docs/FEATURES.md` for overlap. If this task touches an existing feature, reference its ID.
3. Check `docs/PHASES.md` — are we in the right phase for this work?
4. Plan the change in 3–5 bullet points. Reference file paths.

Inner loop (L1) — per feature:

5. **Write the failing test first.** Based on acceptance criteria in `docs/FEATURES.md`. Run it. Confirm it fails for the right reason.
6. **Commit the failing test.** `<phase>/<feature-id>: RED — <summary>`.
7. **Write minimal implementation.** Run the test. Iterate up to 5 times.
8. **On iteration 5 still failing:** STOP. Write `STUCK.md` in the feature's dir with what you tried, the actual error, your best hypothesis. Commit. Escalate.
9. **Test passes:** run `pnpm lint && pnpm typecheck && pnpm test`. Fix (max 3 attempts). Update `docs/FEATURES.md` status to `done` in the same commit as the passing implementation.
10. **Commit.** `<phase>/<feature-id>: GREEN — <summary>`. Optionally a third commit for refactor.

Phase gate (L2) — before declaring phase complete:

11. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:features` — all four green.
12. Verify 0 `STUCK.md` files, 0 uncommitted changes, 100% of the phase's features status=done.
13. Run the phase demo from `docs/PHASES.md` end-to-end. Document proof (log output or screenshot).
14. Human checkpoint (BUILD_PROMPT.md describes how).

**Never mark a feature `done` without a passing test in the same commit.** CI will block PRs that violate this.

---

## 7. Forbidden actions

- Committing secrets, API keys, or `.env` files.
- Bypassing the permission middleware. Any tool-call handler that skips it is a P0 bug.
- Adding dependencies without checking maintenance status. If a package has <1k stars and <5 commits in the last 6 months, don't use it.
- Changing the stack in section 4 without updating `docs/OPEN_DECISIONS.md` first.
- Leaving `TODO` comments without a matching issue or feature row.
- Force-pushing to `main`.

---

## 8. Project-specific gotchas

- **AI SDK v6, not v5.** The `@ai-sdk/mcp` package is now stable and includes OAuth/PKCE token refresh. Use `generateText` with unified tool-calling — v6 merged `generateText` and `generateObject` for structured outputs in tool loops.
- **Mem0 OpenMemory requires an LLM API key at startup** — defaults to OpenAI, but can be configured to use Ollama via `LLM_PROVIDER=ollama` + `LLM_MODEL=<model>` env vars. The wizard pipes the user's choice through. Its MCP endpoint is `http://localhost:8765/mcp/<client-name>/sse/<user-id>` — we pin `client-name=open-greg` and `user-id=default` for single-user mode.
- **Mem0 ships its own UI** at its own port — we disable it (`make up` without `make ui`) and build our memory browser against its REST API instead, to keep the UX unified.
- **Telegram: long polling by default, webhook only if opted in.** Long polling needs no public URL — works fine on a Mac Mini behind NAT. Webhook requires a tunnel (Cloudflare Tunnel recommended, set up in wizard if user opts in). Never run both simultaneously — Telegram returns 409 Conflict if two processes use the same bot token.
- **Playwright persistent-context mode** is how logged-in sessions work. Don't use `launch()` — use `launchPersistentContext()` with the profile dir at `~/.open-greg/browser-profile/`.
- **Anthropic computer-use** requires explicit opt-in per session. The permission middleware handles this, don't replicate the check.
- **Parakeet v3 language auto-detection** is on by default. Don't pass a language hint unless the user explicitly requested one. Model weights ~2.5GB download on first run — show progress.
- **The dashboard and control-plane share types via `packages/shared`.** Don't duplicate type definitions.
- **Every agent run must emit OpenTelemetry spans** — the instrumentation is in `packages/shared/otel.ts`. Just import the wrapped wrappers.
- **Token/cost budget is a hard stop, not a soft warning.** Every session has a max-tokens and max-cost setting; the orchestrator aborts when hit. See `docs/PERMISSIONS.md#budgets`.
- **Destructive actions need approval** — email send, git push, file delete of >N files, any `sudo`. Prompt flow in dashboard or Telegram. See `docs/PERMISSIONS.md#approval-flow`.
- **Every tool call has a timeout** (default 60s, configurable per tool). No indefinite awaits. If a tool times out, the orchestrator marks it failed, logs, moves on.
- **Drizzle migrations are immutable after merge.** Never edit a committed migration — generate a new one. The agent building this should never delete `drizzle/migrations/*.sql`.
- **Timezone is stored in `~/.open-greg/config.yml`** as IANA string (e.g. `Europe/Vienna`). Injected into every agent's system prompt so "today" is unambiguous.

---

_End of AGENTS.md. Everything else is in `docs/`._
