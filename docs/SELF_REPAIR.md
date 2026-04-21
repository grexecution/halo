# Self-Repair & Self-Test Protocol

_How this project gets to production-ready without burning infinite tokens or shipping broken code. The honest version: bounded loops with explicit exit criteria, not "keep trying forever."_

---

## 1. The three layers of self-repair

There are three distinct loops, each with different scope and stopping rules. Conflating them is how autonomous builds go off the rails.

| Loop | Scope | Max iterations | Who runs it | When |
|---|---|---|---|---|
| **L1: Inner repair** | One failing test on one feature | 5 | Coding agent | During feature implementation |
| **L2: Phase repair** | A whole phase's test matrix | 3 | Coding agent | Before phase exit |
| **L3: Runtime repair** | A running production system | ∞ (but only for recovery, not code changes) | The deployed product itself | Always |

L1 and L2 are build-time. L3 is runtime. They don't share code paths and shouldn't be confused.

---

## 2. L1 — Inner repair loop (TDD with exit criteria)

**Pattern: Red → Green → Refactor → Repeat, with a hard stop.**

```
for each feature F in phase:
  1. Read spec from docs/FEATURES.md for F
  2. Write failing test matching acceptance criteria
  3. Run test → CONFIRM it fails (for the right reason)
  4. Write minimal implementation
  5. Run test:
       PASS → go to step 6
       FAIL → iteration++; go back to step 4
       iteration > 5 → STOP, escalate to checkpoint
  6. Run lint, typecheck, related tests
       All pass → mark feature done in FEATURES.md
       Any fail → iteration++; fix; re-run (max 3)
       Still failing after 3 → STOP, escalate
```

**Why 5 for test-passing, 3 for lint/typecheck:** implementation bugs need more exploration; style/type errors are usually mechanical and if you can't fix them in 3 tries you're misreading the error.

**Escalation on STOP:**
- Write a `STUCK.md` file in the feature's directory explaining:
  - What you tried (last 3 approaches, briefly).
  - The failing test output (the actual error, not paraphrased).
  - Your best hypothesis.
  - What you'd try next if you had another iteration.
- Commit this as `p<N>/<feature-id>: STUCK — <one-line summary>`.
- Wait for human input. Do not continue to other features.

This is load-bearing: an agent that silently moves on after failing leaves broken features marked "done." That's worse than no progress.

---

## 3. L2 — Phase repair loop

Before exiting any phase, the agent runs the full phase gate:

```
pnpm lint && pnpm typecheck && pnpm test && pnpm test:features
```

All four must pass. If any fail:

```
iteration = 0
while any of (lint|typecheck|test|test:features) fails:
  iteration++
  if iteration > 3: STOP, escalate
  
  # Regression vs new failure?
  If the failing test is for a feature already status=done → REGRESSION
    - Do not rewrite the feature you're currently on.
    - Find the commit that broke it (git bisect via last green tag).
    - Fix the regression specifically.
    - Add a regression-test comment: "// regresses if <pattern>"
  
  If the failure is on the current feature → continue L1 pattern for that test
  
  If the failure is unrelated (flaky test, LLM nondeterminism):
    - Rerun ONCE.
    - Still failing → treat as real failure, enter L1 on it.
```

**Why max 3:** phase gates shouldn't need more than cleanup passes. If the agent is rebuilding huge chunks of code to pass phase gates, something is structurally wrong — stop and have a human look.

**Exit requires:**
- All four commands green.
- `pnpm test:features` reports 100% of phase's feature IDs as PASS.
- Demo scenario from `docs/PHASES.md` runs end-to-end (verified manually or via e2e test).
- No `STUCK.md` files in the phase's directories.
- Git status clean (no uncommitted changes).

---

## 4. L3 — Runtime repair (the deployed system)

This is different in nature — no code changes, just recovery. Addresses the OpenClaw "goes idle and doesn't know it" failure mode.

### 4.1 Service-level (containers)

Three mechanisms, documented in `docs/ARCHITECTURE.md#13-crash-resilience`:

1. **Docker `restart: unless-stopped`** — kernel-level auto-restart on crash.
2. **Watchdog service** — heartbeats every 30s. 90s silence → restart container + emit event.
3. **Dockerfile `HEALTHCHECK`** — per-service probe that fails fast on deadlock (not just crash).

### 4.2 Agent-level (the LLM loop itself)

Agents have three self-tools plus a stuck-loop detector:

| Tool | What it does | When called |
|---|---|---|
| `self.health_check()` | Query watchdog for all-services status | Before any computer-control tool; on any tool failure |
| `self.recent_errors(n)` | Last N events of type `*.error` | When user says "something's wrong" or self detects repeated failure |
| `self.stuck_detector()` | LLM judge on last N turn deltas — "making progress?" | Every 5 turns on an open goal |
| `self.escalate(summary)` | Abort current work, notify user via default channel | When stuck detector returns "no progress" twice |

**Exit criteria for L3 per session:**
- Session completes (success or explicit failure notification to user).
- Session hits budget cap (F-130).
- Session hits wall-time limit.
- User explicitly stops it.
- Stuck detector fires twice → auto-escalate.

**No infinite retries.** Every retry path has a max attempt count. Every attempt count is logged with a trace span.

### 4.3 Tool-call level

Every tool has a timeout (F-134). Every external call uses `p-retry` with exponential backoff and max 3 attempts.

Retry policy by error type:
- **Network error / 5xx:** retry with backoff.
- **4xx (except 429):** do not retry — client error.
- **429 (rate limit):** retry after `Retry-After` header.
- **Timeout:** retry once with 2× timeout. If still times out, fail.
- **Tool returned `ok: false`:** do NOT auto-retry. The agent sees the error and decides what to do. Auto-retrying a logical error just burns tokens.

---

## 5. Self-testing during the build

The goal isn't "agent writes perfect code on first try." The goal is: **whenever the agent claims a feature is done, `pnpm test:features` proves it.**

**Mandatory verification before marking any feature `done`:**

1. The feature's test file exists at the path specified in `docs/FEATURES.md`.
2. The test file's outer describe is `F-NNN: <exact title from FEATURES.md>`.
3. Running JUST that test passes: `pnpm test -- --run <test-path>`.
4. Running the full phase suite still passes: `pnpm test && pnpm test:features`.
5. Running lint + typecheck passes.
6. The feature's row in `docs/FEATURES.md` is updated to `Status: done` in the same commit as the implementation.

If ANY of these six checks fails, the feature is NOT done. Marking it done anyway is a P0 bug in the build.

**CI enforces this:**
- GitHub Action parses `docs/FEATURES.md`.
- For every row with `Status: done`, verifies the test file exists, the test passes, the describe block matches.
- PR blocked if any done feature fails this.

---

## 6. Nightly regression build

From Phase 2 onward, a nightly job runs:

```
pnpm docker:down --volumes && pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm test && pnpm test:features && pnpm test:e2e
```

Results posted to `artifacts/nightly/<date>.json`. Dashboard has a "Build health" page showing:
- Current pass rate.
- Features that regressed in the last 7 days.
- Average test duration trend (perf regression detector).

A regression creates a GitHub issue automatically (once Phase 5 autonomy is in place — before that, it sends a Telegram message to the configured channel).

---

## 7. "Perfect and production-ready" — what that actually means

There is no such thing as "perfect." There is:

**Shippable v1.0:**
- [ ] Every feature in FEATURES.md is `done` or explicitly `deferred` in `OPEN_DECISIONS.md`.
- [ ] `pnpm test:features` = 100% pass, 3 runs in a row (proves non-flakiness).
- [ ] Demo scenarios from all 7 phases run on a clean machine.
- [ ] No `STUCK.md` files in the repo.
- [ ] Security-regression tests pass: denied paths stay denied, sudo off blocks sudo, panic button kills in-flight.
- [ ] Install story tested on macOS (arm64), Linux x86_64, Linux arm64 in CI.
- [ ] Nightly regression green for 7 consecutive days.
- [ ] Cold-start < 60s. First-turn latency < 3s cloud / < 10s local.
- [ ] `README.md` + demo video.
- [ ] `docs/RUNBOOK.md` validated — every failure mode can be reproduced and recovered.

That's the exit criterion for v1.0. No feature is added past this point until it's reached.

**Not "perfect":**
- 100% code coverage (we aim for ~80% on critical paths, lower elsewhere).
- Zero TODO comments (some are legitimate and tracked with feature IDs).
- Zero known bugs (minor ones go to v1.1 backlog).

An autonomous build agent trying to achieve actual perfection will loop forever. The exit criteria above are deliberately objective and finite.

---

## 8. Fail-fast rules (when to STOP, not iterate)

The agent stops immediately — no retry, no workaround, no "clever fix" — when:

- A **security test** fails (denied path becomes allowed, panic doesn't kill a session, sudo toggle has no effect).
- A **permission middleware bypass** is introduced (CI lint rule detects this).
- A **migration is deleted** after being committed.
- A **secret is committed** (pre-commit hook + CI scan).
- The **feature-test runner** itself fails to run (can't read FEATURES.md, regex broken, etc.).
- **Budget enforcement** breaks (sessions exceed caps without aborting).
- A **regression test** for an already-`done` feature fails twice in a row on different commits (indicates architectural instability).

On any of these: stop, commit everything as-is to a rescue branch `rescue/<date>-<reason>`, write a clear summary, escalate. These conditions represent problems that "just trying harder" cannot fix safely.

---

## 9. Honest caveats

- **LLM coding agents are not deterministic.** The same prompt on the same repo can produce different code. Tests catch functional regressions but don't catch subtle style drift. A human should sweep the code at each phase boundary.
- **Five iterations per test is a heuristic, not science.** Increase for hard features, decrease for trivial ones. The point is having a bound, not the specific number.
- **Self-healing is not a replacement for design.** If the agent needs to self-heal a feature three times during implementation, the feature spec is probably wrong. Fix the spec, not the code.
- **Runtime self-repair is about availability, not correctness.** A crashed container that restarts is good; a buggy agent whose bugs get "healed" into different bugs is bad. The runtime layer never modifies code — only restarts, retries, and escalates.
- **"Production-ready" is a claim, not an achievement.** It stays true only as long as the regression suite stays green and the monitoring stays healthy. The work doesn't stop at v1.0 — it shifts to maintenance.

---

_End of SELF_REPAIR.md._
