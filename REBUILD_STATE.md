# Rebuild State — Mastra + DBOS Migration

_Last updated: 2026-04-22. If I crash, read this first, then resume from the current step._

## Goal

Replace the stub orchestration backend (control-plane) with a real Mastra agent + DBOS durable workflows stack. Wire the existing dashboard to use it. End state: end-to-end chat → Mastra agent → tools → memory → response, all persisted durably.

## Stack decisions

- **Mastra `mastra` v1.6.1** — agent graph, tool registry, built-in memory
- **`@mastra/memory` v1.16.0 + `@mastra/libsql`** — layered memory (already in dashboard, moving to shared)
- **DBOS `@dbos-inc/dbos-sdk` v4.14.6** — durable workflow execution on Postgres (crash-resume)
- **Keep** Fastify as HTTP server, tRPC for type-safe routes, existing tools/permissions packages

## Steps

| #   | Step                                              | Status         | Notes                                                                                                 |
| --- | ------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Install Mastra + DBOS deps in control-plane       | ⏳ IN PROGRESS | Adding mastra, @dbos-inc/dbos-sdk, @mastra/memory, @mastra/libsql, @mastra/fastembed to control-plane |
| 2   | Wire Mastra agent into control-plane orchestrator | pending        | Replace orchestrator.ts stub with real Mastra Agent + tool calls                                      |
| 3   | Add DBOS durable workflows for goal-loop + cron   | pending        | Replace goal-loop.ts stub with DBOS @Workflow + @Step                                                 |
| 4   | Wire existing tools as Mastra tools               | pending        | shell, get_time from packages/tools → Mastra createTool()                                             |
| 5   | Rewire dashboard API routes                       | pending        | /api/chat, /api/chats, /api/goals, /api/crons → call control-plane via tRPC                           |
| 6   | Drop Mem0, use Mastra memory throughout           | pending        | Remove @open-greg/memory Mem0 wrapper, use @mastra/memory directly                                    |
| 7   | Typecheck + tests green                           | pending        | pnpm typecheck && pnpm test                                                                           |

## Key file locations

- Control-plane entry: `services/control-plane/src/index.ts`
- Orchestrator stub: `services/control-plane/src/orchestrator.ts`
- Goal-loop stub: `services/control-plane/src/goal-loop.ts`
- Session store stub: `services/control-plane/src/session-store.ts`
- Sub-agent stub: `services/control-plane/src/sub-agent.ts`
- Budget tracker (keep): `services/control-plane/src/budget.ts`
- Dashboard chat route: `apps/dashboard/app/api/chat/route.ts`
- Dashboard memory lib: `apps/dashboard/app/lib/memory.ts`
- Dashboard db lib: `apps/dashboard/app/lib/db.ts`
- Permissions middleware: `packages/permissions/src/index.ts`
- Tools: `packages/tools/src/shell.ts`, `packages/tools/src/index.ts`

## Architecture after rebuild

```
Dashboard (Next.js)
  └── /api/chat  ──tRPC──►  Control-plane (Fastify)
                               └── Mastra Agent
                                     ├── Tools (shell, browser, get_time, ...)
                                     ├── Memory (@mastra/memory + LibSQL)
                                     └── DBOS Workflows (goals, cron)
```

## Storage after rebuild

- `~/.open-greg/memory.db` — Mastra LibSQL (memory, threads, embeddings)
- `~/.open-greg/app.db` — SQLite app state (settings, agents, workspaces, goals, crons)
- Postgres (Docker) — DBOS durable workflow state

## Context if resuming

1. Read this file
2. Check which step is IN PROGRESS
3. Read the relevant source files listed above
4. Continue from that step
