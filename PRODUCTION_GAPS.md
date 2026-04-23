# Production Gaps — open-greg vs OpenClaw

_Audit date: 2026-04-23. Baseline: 336/336 tests green, 0 typecheck errors._

---

## P0 — Blockers (breaks core user flows)

| #   | Gap                                        | Root cause                                                                                                                              | Fix                                                      |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | **PanicButton is cosmetic**                | `PanicButton.tsx` sets local state only — no API call. No `/api/panic` endpoint exists.                                                 | Add `POST /api/panic` to control-plane; button calls it. |
| 2   | **VoiceRecorder returns hardcoded text**   | `setTimeout(() => 'Transcribed voice input')` — never hits microphone.                                                                  | Wire real `MediaRecorder` → base64 → whisper endpoint.   |
| 3   | **Hardcoded `localhost:3001` in 4 places** | `settings/page.tsx:169`, `api/plugins/[id]/route.ts:35`, `api/logs/route.ts:4`, `api/settings/route.ts:25` do not import from `env.ts`. | Import `CONTROL_PLANE_URL` from `lib/env.ts`.            |
| 4   | **Model name mismatch**                    | Dashboard agents default to `claude-sonnet-4-6`; control-plane uses `claude-haiku-4-5-20251001`. Different models silently used.        | Align defaults — pick one model name, use it everywhere. |

---

## P1 — Missing pages / features that users expect

| #   | Gap                                     | Notes                                                                                                                                |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 5   | **No `/approvals` page**                | Inline approval exists in chat but there's nowhere to see ALL pending approvals across all sessions. Critical for autonomous agents. |
| 6   | **No `/runs` page (agent run history)** | No audit trail of past agent executions, inputs/outputs, duration, cost. Needed for debugging + trust.                               |
| 7   | **No cost/usage analytics**             | Logs show per-entry cost but no daily/weekly totals, no per-agent breakdown, no budget headroom display.                             |
| 8   | **No knowledge base / document upload** | Memory browser exists but no way to upload PDFs, docs, web pages into the RAG pipeline.                                              |
| 9   | **Approval queue not wired to agent**   | When agent requests approval, it blocks the turn. If user approves via `/approvals` page, there's no mechanism to resume the turn.   |

---

## P2 — Quality / polish gaps

| #   | Gap                                                  | Notes                                                                         |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| 10  | **Settings page is 1760 lines** (single component)   | Slow to render, hard to maintain. Split into tab-specific lazy components.    |
| 11  | **Connectors page is 1760 lines** (single component) | Same issue.                                                                   |
| 12  | **No error boundary in chat**                        | Raw JSON error shown when control-plane is down. Need user-friendly fallback. |
| 13  | **Logs page polls every 3s**                         | Should use SSE or WebSocket for real-time. Polling causes unnecessary load.   |
| 14  | **No agent status in sidebar**                       | No live indicator showing how many agents are currently running.              |
| 15  | **Version hardcoded** as `0.1.0` in 2 places         | Should read from `package.json`.                                              |
| 16  | **Session budget not persisted**                     | `SessionBudget` is in-memory only. Resets on control-plane restart.           |

---

## P3 — Browser/voice/vision (service stubs)

These are large features — tracked but deferred to separate phases:

| Service                | Status                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| `browser-service`      | Pool management real; `scrape()`/`act()` dry-run only. Playwright not installed. |
| `voice-service`        | 100% `NotImplementedError`.                                                      |
| `vision-service`       | 100% `NotImplementedError`.                                                      |
| CLI interactive wizard | Prints "not yet implemented" and exits.                                          |

---

## What we WILL fix in this session (P0 + P1)

1. ✅ Fix all 4 hardcoded `localhost:3001` references
2. ✅ Wire PanicButton → `POST /api/panic` (control-plane broadcasts stop to all sessions)
3. ✅ Fix VoiceRecorder with real `MediaRecorder` → base64 → `/api/voice/transcribe`
4. ✅ Fix model name mismatch (align to `claude-haiku-4-5-20251001` or env-driven)
5. ✅ Add `/approvals` page — pending agent actions across all sessions
6. ✅ Add `/runs` page — agent execution history with cost + duration
7. ✅ Add cost analytics banner to `/logs` page
8. ✅ Add `/knowledge` page — document upload into memory/RAG
9. ✅ Add live "running agents" count to sidebar
10. ✅ Fix chat error boundary

---

_P2/P3 gaps (service stubs, analytics deep-dive, workflow builder) are separate phases._
