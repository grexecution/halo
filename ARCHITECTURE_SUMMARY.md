# Architecture Summary

> _Quick-reference for developers. The authoritative source is `docs/ARCHITECTURE.md`. Read that before any cross-service change._

---

## System topology

```
Browser / Telegram / Discord / Slack / Voice
          │
          ▼
┌─────────────────────────────────────────────┐
│  Dashboard — Next.js 15           :3000      │
│  Chat · Agents · Memory · Cron · Logs       │
│  Connectors · Registry · Settings           │
└──────────────┬──────────────────────────────┘
               │ tRPC over HTTP (SSE for streaming)
               ▼
┌─────────────────────────────────────────────┐
│  Control Plane — Fastify + tRPC   :4000      │
│  AgentOrchestrator                          │
│  PermissionMiddleware  ← every tool goes through this
│  ToolRegistry (native + MCP)                │
│  CronScheduler (BullMQ) + GoalLoop          │
│  NotificationRouter                         │
└──┬─────┬─────┬─────┬─────┬─────┬─────┬─────┘
   │     │     │     │     │     │     │
   ▼     ▼     ▼     ▼     ▼     ▼     ▼
  LLM  Mem0  Shell  Play  Voice Vision  MCP
  gtwy  +pg   /FS  wright service service clients
       vect
              ↕ Postgres 16 + pgvector
              ↕ Redis (BullMQ queues + pubsub)
```

---

## Component reference

| Component            | Package/Service            | Port     | Language                |
| -------------------- | -------------------------- | -------- | ----------------------- |
| Dashboard            | `apps/dashboard`           | 3000     | TypeScript / Next.js 15 |
| Control Plane        | `services/control-plane`   | 4000     | TypeScript / Fastify    |
| Watchdog             | `services/watchdog`        | internal | TypeScript              |
| Browser Service      | `services/browser-service` | internal | TypeScript / Playwright |
| Voice Service        | `services/voice-service`   | internal | Python / FastAPI        |
| Vision Service       | `services/vision-service`  | internal | Python / FastAPI        |
| AgentOrchestrator    | `packages/agent-core`      | —        | TypeScript              |
| PermissionMiddleware | `packages/permissions`     | —        | TypeScript              |
| Memory client        | `packages/memory`          | —        | TypeScript → Mem0 REST  |
| MCP registry         | `packages/connectors`      | —        | TypeScript              |
| Native tools         | `packages/tools`           | —        | TypeScript              |
| Telemetry            | `packages/telemetry`       | —        | TypeScript / OTel       |
| Shared types         | `packages/shared`          | —        | TypeScript              |
| Mem0 OpenMemory      | Docker container           | 8765     | managed                 |
| Postgres 16          | Docker container           | 5432     | managed                 |
| Redis                | Docker container           | 6379     | managed                 |
| Ollama               | Docker container           | 11434    | managed                 |
| Qdrant               | Docker container           | 6333     | managed (via Mem0)      |

---

## The permission middleware — never skip this

Every tool call — native or MCP — must flow through:

```ts
PermissionMiddleware.check(toolId, args, ctx) → allow | deny | prompt
```

- Config source: `~/.open-greg/permissions.yml`, hot-reloaded on change (chokidar).
- Skipping it is a P0 bug. ESLint rule `no-bypass-permission` enforces this at CI.
- The `defineTool()` wrapper in `packages/tools` wraps the middleware automatically — never register tools outside of it.

---

## Agent model

**Main agent** — single instance, generalist system prompt ("Claw" by default).

**Sub-agents** — each has a `@handle` (e.g. `@coder`, `@researcher`, `@email`). Called by:

- User typing `@handle task` in chat or Telegram.
- Main agent emitting `delegate(@handle, task)` tool call.
- Max nesting depth: 3.

**Critic sub-agent** — automatically invoked before a goal is marked done. Returns `approve` or `revise <reason>`. Max 3 critic loops per goal.

**Agent session lifecycle:**

1. Message received (any channel).
2. Orchestrator identifies target agent.
3. Pre-prompt: top-N memories injected from Mem0.
4. LLM call (Vercel AI SDK v6 `generateText` with tools).
5. Tool calls routed through PermissionMiddleware.
6. Responses streamed back via SSE.
7. All messages, tool calls, results persisted to Postgres.
8. Memory extraction happens async after turn.

---

## State persistence rules

| What                     | Where                                         | Why                            |
| ------------------------ | --------------------------------------------- | ------------------------------ |
| All messages             | `messages` table (Postgres)                   | Restart = resume               |
| All tool calls + results | `tool_calls` table                            | Audit trail + memory           |
| Agent configs            | `agents` table                                | CRUD via dashboard             |
| Cron jobs                | `cron_jobs` table                             | BullMQ reads this              |
| Goals                    | `goals` table                                 | Goal-loop worker reads this    |
| Permissions              | `~/.open-greg/permissions.yml` (hot-reloaded) | User editable                  |
| Secrets / API keys       | OS keychain via `keytar`                      | Never in DB or env files       |
| Memory / knowledge graph | Mem0 → Qdrant + Postgres                      | Cross-connector entity linking |
| Browser sessions         | `~/.open-greg/browser-profile/`               | Persistent login state         |

**Rule: no in-process state that matters. Any crash must be recoverable from DB alone.**

---

## Browser modes (Playwright)

| Mode                   | When to use                      | Tool                                    |
| ---------------------- | -------------------------------- | --------------------------------------- |
| A — Scraping           | Bulk reads, no interaction       | `browser.scrape(url, selector?)`        |
| B — Headless agent     | Automated flows with vision loop | `browser.act(goal)`                     |
| C — Persistent profile | Logged-in sessions (Gmail, etc.) | `browser.act(goal, {persistent: true})` |

- Pool: max 3 concurrent contexts by default.
- Mode B: screenshot every action, max 30 steps per call.
- Always use `launchPersistentContext()` — never `launch()` raw.

---

## Memory architecture

```
Every message / tool call / connector pull / file read
          │
          ▼
   Mem0 OpenMemory (localhost:8765)
          │
      extraction LLM
          │
    entity linking
          │
   ┌──────┴──────┐
Qdrant         Postgres
(vectors)    (entities + relations)
```

- Pre-turn: top-N relevant memories injected into system context automatically.
- Agent can also call `memory.search(query)` explicitly.
- Mem0's own UI is disabled — our dashboard's memory browser talks to Mem0's REST API.

---

## Messaging channels

All channels converge into one message bus in the control plane.

| Channel  | Library          | Notes                                                                                                                              |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Telegram | grammy           | Long-polling by default. Webhook opt-in (needs tunnel). Group chats with `@handle` routing. Never run 2 processes with same token. |
| Discord  | discord.js       | Slash commands per agent, threaded.                                                                                                |
| Slack    | @slack/bolt      | Thread = session.                                                                                                                  |
| Email    | Gmail MCP + SMTP | Label-filtered polling → session spawn → SMTP reply.                                                                               |

---

## Crash resilience layers

1. **Docker restart policies** — `restart: unless-stopped` on every container.
2. **Watchdog service** — heartbeat every 30s; restarts silent containers after 90s. Runs outside the supervised network (launchd/systemd).
3. **Agent self-awareness** — `self.health_check()` and `self.recent_errors()` tools. Stuck-loop detector (3 identical tool calls → inject reset prompt).

---

## Security boundaries

- Dashboard binds to `127.0.0.1` only. LAN requires explicit opt-in + basic auth (`BASIC_AUTH_USER`/`_PASSWORD`).
- Control plane accepts only localhost connections.
- No secrets on disk. Keychain only. On headless Linux: AES-256-GCM file at `~/.open-greg/secrets.enc` + `GREG_SECRET_PASSPHRASE` env var.
- All outbound URLs checked against whitelist if `network.url_whitelist_mode: true`.
- Shell commands logged (cmd + exit code + first 10KB output).
- Docker containers run as non-root where possible.

---

## Key data flows

**User chat turn:**

```
Dashboard input → tRPC → AgentOrchestrator
  → inject memories → LLM (Vercel AI SDK v6)
  → tool call? → PermissionMiddleware.check()
    → allow: execute → return result to LLM
    → deny: return error to LLM
    → prompt: SSE approval request to dashboard → user action → continue
  → stream tokens → SSE → dashboard
  → persist messages → async memory extraction
```

**Cron job:**

```
BullMQ repeatable job fires → create agent session
  → run turn with goal prompt → critic review
  → complete → NotificationRouter
    → dashboard active? → SSE push
    → else → Telegram message
```

**Tool registration:**

```ts
// packages/tools/src/my-tool.ts
export const myTool = defineTool({
  id: 'my.tool',
  description: 'Does X.',
  schema: z.object({ ... }),
  permissions_required: ['scope.action'],
  handler: async (args, ctx) => { ... },
});
// Never export raw handlers. defineTool() wraps the middleware.
```

---

_For the full spec see `docs/ARCHITECTURE.md`. Update that file when architecture changes — stale docs are worse than no docs._
