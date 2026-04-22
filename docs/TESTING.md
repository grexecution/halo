# Testing

_How we test. Why `pnpm test:features` exists. What "done" means._

---

## Philosophy

Three tiers:

1. **Unit tests** — fast, isolated. Run on every save. Vitest / pytest.
2. **Integration tests** — cross-module. Run on PR. Real DB (testcontainers), real Redis, mocked LLM.
3. **Feature tests** — the matrix in `docs/FEATURES.md`. Run before releases and nightly. Real-ish end-to-end, one per feature ID.

## The feature-test runner

`pnpm test:features` does:

1. Parses `docs/FEATURES.md` with a regex.
2. For every row with `Status: done`, resolves the `Test:` path.
3. Runs each test. Aggregates pass/fail.
4. Prints a table: `F-ID | Feature name | PASS/FAIL | Duration`.
5. Exits non-zero if any fail.

Implementation: `scripts/test-features.ts` (~150 lines). No fancy framework — just markdown parsing and process spawning.

This is the regression safety net. When a new feature lands, this runner proves nothing else broke. When someone says "the agent works," this is what they mean.

## Writing a feature test

Checklist:

- One test file per feature ID.
- Name the outer describe block `F-NNN: <title>`.
- Assert the acceptance criteria from `docs/FEATURES.md` verbatim.
- If the test requires live services, use testcontainers; if it requires live LLM, gate on `INTEGRATION=1` env var.
- If the feature is only testable manually (e.g. F-113 24h continuous project), use `manual:<slug>` as the path and add the checklist to `docs/MANUAL_TESTS.md`.

## Manual test policy

Some features can't be automated reasonably:

- 24-hour autonomy runs (F-113).
- Voice latency on specific hardware.
- OAuth flows that require a human to click "allow."

Each manual test has a numbered checklist in `docs/MANUAL_TESTS.md`. Before a release, a human runs through each and checks off.

## Mocks and fixtures

- **LLM mock**: `@open-greg/shared/testing/mock-llm`. Deterministic responses keyed by prompt hash. Used in 90% of integration tests.
- **MCP mock**: `packages/connectors/testing/mock-mcp`. Implements the MCP transport; responses configurable per test.
- **Browser mock**: Playwright already records+replays. Use traces for flaky-flow debugging.
- **Clock mock**: `@sinonjs/fake-timers` for cron / goal-loop tests.
- **Filesystem**: memfs for unit tests, real tmp dirs for integration.

## Handling LLM non-determinism

Real-LLM tests (gated on `INTEGRATION=1`) are inherently non-deterministic. Rules:

- **Never** assert on exact LLM output text. Assert on tool calls made, structured-output fields, or whether the output matches a regex/predicate.
- Use `temperature: 0` and `seed` where the provider supports it.
- Every real-LLM test wrapped in `retry(3)`. If it fails all three, fail the test — but flakiness is logged, not a retry-to-green-at-all-costs pattern.
- Snapshot tests for LLM output are **forbidden**. Use behavior assertions only.
- Per-test cost cap (default $0.10) — overrun aborts the test run.

## CI

`.github/workflows/ci.yml`:

- Lint + typecheck on every PR.
- Unit tests on every PR.
- Integration tests on PR (without live LLM — uses mock-llm).
- Feature tests on merge to main, nightly, and before tagged releases.

## Performance regressions

Key metrics captured on every feature-test run:

- First-turn latency (local LLM and cloud LLM).
- Cold-start time.
- Memory-retrieval latency.
- Browser-act step latency.

Results logged to `artifacts/perf.jsonl`. Trend watched in a basic perf dashboard (Phase 7).

## When a test fails

- PR CI fail: fix before merge.
- Nightly fail: creates a GitHub issue automatically (post-Phase 5, when we have the autonomy to do this ourselves).
- Feature test fail after someone else's change: block their merge, ping them.

---

_End of TESTING.md._
