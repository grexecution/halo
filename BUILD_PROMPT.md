# BUILD_PROMPT.md

_This file is the master prompt. Feed it to a capable autonomous coding agent (Claude Code, Cursor composer, Aider in `--yes-always` mode with care). It runs for many hours and builds the whole project phase by phase. Review between phases._

---

## How to run this

1. Clone this spec repo to a new working directory.
2. Ensure Docker is running, Node 22 and pnpm are installed.
3. Start your coding agent in this directory (`claude` or `cursor-composer` or similar).
4. Paste the **Master Instruction** below as the first message.
5. Let it work. Check in at phase boundaries.
6. When the agent pauses at a "HUMAN CHECKPOINT", review the phase output, run the demo, approve or request changes.
7. If the agent gets stuck, reset to the last green commit and re-prompt from there.

---

## Master Instruction (paste this)

> You are building an open-source project named (working title) `claw-alt`. The full specification is in `AGENTS.md` and the files it links to under `docs/`. Your job is to implement it, phase by phase, test-driven, with bounded self-repair.
>
> **Read these first, in order:**
> 1. `AGENTS.md` — entry point.
> 2. `docs/SELF_REPAIR.md` — the iteration bounds and stop rules. Critical.
> 3. `docs/ARCHITECTURE.md` — the system.
> 4. `docs/PHASES.md` — the plan you execute.
> 5. `docs/FEATURES.md` — what to build and how to test.
> 6. `docs/CONVENTIONS.md` — how to write code here.
> 7. `docs/PERMISSIONS.md`, `docs/DATA_MODEL.md`, `docs/RUNBOOK.md` — reference as needed.
>
> **Your loop (bounded TDD):**
>
> For each phase in `docs/PHASES.md`, in order, for each feature in the phase:
>
>  1. **RED.** Write a failing test matching the acceptance criteria in `docs/FEATURES.md`. Run it. Confirm it fails for the right reason. Commit as `<phase>/<feature-id>: RED`.
>  2. **GREEN.** Write minimal implementation. Run the test. If it fails, iterate — up to **5 attempts** on this specific test. Then STOP.
>  3. **STOP rule:** if attempt 6 is needed, do NOT continue. Write `STUCK.md` in the feature's directory containing:
>      - What you tried (last 3 approaches briefly).
>      - The literal failing test output.
>      - Your best hypothesis.
>      - What you'd try next.
>     Commit and wait for input. Do NOT move on to other features.
>  4. **VERIFY.** Once the feature's test passes, run `pnpm lint && pnpm typecheck && pnpm test`. Fix, max 3 attempts. Still failing → STUCK.md + stop.
>  5. **MARK DONE.** Update `docs/FEATURES.md` row for this feature to `Status: done` in the same commit as the implementation. Commit as `<phase>/<feature-id>: GREEN`.
>
> **Phase gate (before moving to next phase):**
>
>  6. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:features`. All four green.
>  7. Verify: no `STUCK.md` files, no uncommitted changes, all phase features `done`.
>  8. Run the phase demo from `docs/PHASES.md` end-to-end.
>  9. Summarize shipped features, test results, demo outcome. **HUMAN CHECKPOINT.** Wait for "proceed."
>
> **Regression handling:**
>
>  - If a feature already marked `done` has its test fail while you're working on a new one, that's a REGRESSION.
>  - Do NOT rewrite the current feature. Find the commit that broke the previous one (`git log` + bisect if needed).
>  - Fix the regression. Add a regression comment in the test: `// regression guard: <pattern>`.
>  - If the same feature regresses twice across different commits, that's an architectural instability signal — STOP and escalate.
>
> **Fail-fast conditions (never retry, always escalate):**
>
>  - Security test failure (denied path becomes allowed, panic button doesn't work, sudo toggle ineffective).
>  - Permission middleware bypass (CI lint rule fires).
>  - Migration deletion.
>  - Secret committed.
>  - Budget enforcement broken (session exceeds cap without aborting).
>  - The feature-test runner itself fails to run.
>
>  On any of these: commit current state to `rescue/<date>-<reason>` branch, write summary, stop. These represent problems where "trying harder" makes things worse.
>
> **Rules (restated for clarity):**
>
>  - Follow `AGENTS.md` section 3 (Golden Rules, now includes bounded iteration) at all times.
>  - Every tool call added must go through the permission middleware.
>  - Do not skip ahead. No Phase-4 code during Phase 2.
>  - If a feature's acceptance criteria is ambiguous, stop and ask before assuming.
>  - Prefer well-known libraries over writing from scratch.
>  - No `any`. No committed secrets. No permission bypass.
>  - A feature marked `done` without a passing test is a P0 bug — CI enforces this.
>  - The goal is NOT "perfect code" — the goal is meeting the exit criteria in `docs/SELF_REPAIR.md#7`. Stop trying to polish past those.
>
> **When uncertain:** grep `docs/`. Still uncertain? Stop and ask. Never guess on security-sensitive details.
>
> **Budget awareness:** you are running with finite tokens and real money. Every iteration costs. If you notice yourself repeating the same approach: STOP, that's the 5-attempt rule firing. Write STUCK.md.
>
> Begin with Phase 1. Before any code, confirm in chat:
>  - "I have read `AGENTS.md`, `docs/SELF_REPAIR.md`, and the docs listed in section 2."
>  - "I understand the 5/3 iteration bounds and the fail-fast conditions."
>  - "My plan for Phase 1 is …"
>
> Then wait for "go."

---

## Phase-specific prompt additions

Some phases have extra context worth injecting at the start:

### At start of Phase 3
> Remember: sub-agent handles are stable strings. Once shipped, a handle is permanent for that agent. Tests elsewhere may reference `@coder`, `@email`, etc. If you rename an agent, you break tests.

### At start of Phase 4
> Security phase. Every tool call added here needs a permission check *and* a test that proves the check blocks the right calls. Pay extra attention to F-045 (non-bypass lint rule). Run that test manually by trying to write a handler that bypasses middleware — it should fail lint.

### At start of Phase 5
> Autonomy phase. Every cron / goal completion must notify. A silent completion is a bug. The `notification_channel` column on goals overrides the default, but default-to-Telegram is correct when unset.

### At start of Phase 6
> Voice phase. NeMo models are heavy downloads. Expect the first `docker compose up` of the voice service to take 10+ minutes. Show progress. Do not assume GPU — these models work on CPU but slower.

### At start of Phase 7
> Polish phase. No new features unless they're polish-tier. Focus on cold-start time, install story, docs. If you find yourself wanting to build something new, file it for v2 in `docs/OPEN_DECISIONS.md`.

---

## When to override the agent

Stop the agent and intervene if:

- It proposes a dependency not on the stack list without a note in `OPEN_DECISIONS.md`.
- It starts implementing in a language other than TypeScript/Python.
- It suggests bypassing the permission middleware "just for this one case."
- Test coverage drops below the "one test per feature" baseline.
- It silently marks a feature `done` without a passing test.

---

## Recovery

If the build goes off the rails:
- `git reset --hard <last-green-commit>`.
- Fix or clarify the relevant doc.
- Re-prompt from the failing feature ID (not from Phase 1).

---

## Success criteria

The build is done when:
- Every feature in `docs/FEATURES.md` is `done` or explicitly `deferred`.
- `pnpm test:features` reports 100% pass.
- The Phase 7 demo runs on a clean machine in under 10 minutes.
- The npm package `create-claw-alt` is published.
- `README.md` has a 2-minute demo video.

Good luck. Build something we'd actually use.

---

_End of BUILD_PROMPT.md._
