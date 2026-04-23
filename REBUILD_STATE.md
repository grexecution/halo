# Rebuild State — Mastra + DBOS Migration

_Last updated: 2026-04-24. Migration complete._

## Status: ✅ COMPLETE

All 7 steps of the Mastra+DBOS migration are done. The control-plane runs a real Mastra Agent + DBOS durable workflows. No active migration blocking further work.

---

## What was migrated

| #   | Step                                              | Status  | Notes                                                                         |
| --- | ------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| 1   | Install Mastra + DBOS deps in control-plane       | ✅ Done | mastra, @dbos-inc/dbos-sdk, @mastra/memory, @mastra/libsql, @mastra/fastembed |
| 2   | Wire Mastra agent into control-plane orchestrator | ✅ Done | Real Mastra Agent + tool calls in orchestrator.ts                             |
| 3   | Add DBOS durable workflows for goal-loop + cron   | ✅ Done | dbos-workflows.ts — GoalWorkflow + CronWorkflow                               |
| 4   | Wire existing tools as Mastra tools               | ✅ Done | 11+ tools in mastra-tools.ts via createTool()                                 |
| 5   | Rewire dashboard API routes                       | ✅ Done | /api/chat, /api/chats, /api/goals, /api/crons all call control-plane          |
| 6   | Drop Mem0, use Mastra memory throughout           | ✅ Done | @mastra/memory + @mastra/pg in control-plane; @open-greg/memory for packages  |
| 7   | Typecheck + tests green                           | ✅ Done | 482/482 passing, 0 typecheck errors                                           |

---

## Current architecture

```
Dashboard (Next.js 15)
  └── /api/*  ──HTTP──►  Control-plane (Fastify)
                           ├── Mastra Agent (orchestrator.ts)
                           │     ├── 11+ Tools (mastra-tools.ts)
                           │     ├── Memory (@mastra/memory + @mastra/pg)
                           │     └── SkillStore + SkillReflector
                           ├── DBOS Workflows (dbos-workflows.ts)
                           │     ├── GoalWorkflow
                           │     └── CronWorkflow
                           ├── Heartbeat scheduler (heartbeat.ts)
                           ├── Canvas manager (canvas-manager.ts)
                           ├── Model router (model-router.ts)
                           └── Sandbox manager (sandbox-manager.ts)
```

## Storage

- `~/.open-greg/settings.json` — app settings (LLM config, Telegram token, agent personality)
- `~/.open-greg/app.db` — SQLite app state (agents, sessions, goals, crons, auth, skills, preferences)
- `~/.open-greg/skills/<agentId>/` — skill markdown files (SkillStore)
- `~/.open-greg/journal.md` — append-only session journal
- Postgres (Docker) — DBOS durable workflow state, pgvector embeddings, FTS documents
- Redis (Docker) — BullMQ job queues

## Key file locations

- Control-plane entry: `services/control-plane/src/index.ts`
- Mastra agent: `services/control-plane/src/mastra-instance.ts`
- Orchestrator: `services/control-plane/src/orchestrator.ts`
- Tools: `services/control-plane/src/mastra-tools.ts`
- DBOS workflows: `services/control-plane/src/dbos-workflows.ts`
- Permissions middleware: `packages/permissions/src/index.ts`
- Memory package: `packages/memory/src/`
- Skills: `services/control-plane/src/skill-store.ts`, `skill-loader.ts`, `skill-reflector.ts`
