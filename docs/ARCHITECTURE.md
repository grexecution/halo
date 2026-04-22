# Architecture

_Read this before making cross-service changes. Update this file when architecture changes._

---

## 1. System overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Dashboard (Next.js 15)                      http://localhost:3000│
│   - Chat (assistant-ui)                                           │
│   - Agents page / Connectors page / Memory browser                │
│   - Permission toggles / Cron & Goals / Logs                      │
│   - Registry view (MCPs + npm packages + LLMs)                    │
└───────────────────────┬──────────────────────────────────────────┘
                        │ tRPC over HTTP
┌───────────────────────▼──────────────────────────────────────────┐
│  Control Plane (Fastify + tRPC)              http://localhost:4000│
│   - AgentOrchestrator (main + sub-agents)                         │
│   - PermissionMiddleware (wraps every tool call)                  │
│   - ToolRegistry (MCP + native tools)                             │
│   - CronScheduler (BullMQ)                                        │
│   - GoalLoop (background worker)                                  │
│   - NotificationRouter (→ Telegram / Discord / Slack / Email)     │
│   - Watchdog client (reports health)                              │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────┘
   │      │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
│ LLM ││ Mem ││Comp ││Brows││Voice││Vision││Msg  ││MCP  ││Watch│
│gtwy ││(Mem0││uter ││er   ││(STT/││/OCR ││hub  ││clnts││dog  │
│     ││+pg- ││use  ││(Play││TTS) ││     ││     ││     ││     │
│     ││vect)││     ││wrght││     ││     ││     ││     ││     │
└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘

Data: Postgres 16 (+pgvector) • Redis (queues + pubsub)
Obs:  OpenTelemetry → (optional) SigNoz at otel.bluemonkeys.at
Secrets: OS keychain via keytar (never on disk)
```

Every "service" in the diagram is a Docker container with `restart: unless-stopped`. The watchdog runs outside the network of supervised services so it can restart them without itself going down.

---

## 2. Repo layout (pnpm monorepo)

```
open-greg/
├── AGENTS.md                 # entry point for AI agents (symlinked CLAUDE.md)
├── README.md                 # human entry point
├── BUILD_PROMPT.md           # the "vibe-code the whole thing" master prompt
├── docs/                     # all spec docs (this folder)
├── apps/
│   ├── cli/                  # the npm package: `npx create-open-greg init`
│   └── dashboard/            # Next.js 15 dashboard
├── services/
│   ├── control-plane/        # Fastify + tRPC agent orchestrator
│   ├── watchdog/             # health checker + restarter
│   ├── browser-service/      # Playwright pool
│   ├── voice-service/        # STT/TTS (Python, NeMo + Piper)
│   └── vision-service/       # OCR + VLM (Python)
├── packages/
│   ├── shared/               # shared types, zod schemas, OTel wrappers
│   ├── agent-core/           # AgentOrchestrator, Sub-agent base class
│   ├── permissions/          # PermissionMiddleware + YAML loader
│   ├── memory/               # Mem0/Hindsight client abstractions
│   ├── connectors/           # MCP client registry + OAuth flows
│   ├── tools/                # native tool implementations
│   └── telemetry/            # OpenTelemetry instrumentation
├── docker/
│   ├── compose.yml           # Postgres, Redis, Ollama, Mem0, Qdrant
│   ├── compose.voice.yml     # optional voice stack
│   └── Dockerfile.*          # per-service dockerfiles
└── .github/
    └── workflows/            # CI
```

---

## 3. Dashboard (apps/dashboard)

- **Framework:** Next.js 15 App Router, React Server Components where free.
- **Styling:** Tailwind + shadcn/ui. Dark-mode-first.
- **State:** TanStack Query + tRPC client. No Redux.
- **Chat UI:** assistant-ui, wired to control-plane via SSE streaming.
- **Voice out:** audio player component that plays TTS responses inline. Mic button for voice in.
- **Auth:** none in v1 — single user on localhost. If exposed to LAN, `BASIC_AUTH_USER`/`_PASSWORD` env vars enable basic auth.

**Pages:**

- `/chat` — main chat + per-sub-agent tabs.
- `/agents` — CRUD agents. Each has: name, system prompt, model, enabled tools, permission scope.
- `/connectors` — MCP marketplace + custom MCP add + OAuth flows. Also LLM provider configuration.
- `/memory` — search/browse/delete memories. Export to JSON.
- `/cron` — cron jobs and goals list. Edit schedules. Pause/resume.
- `/logs` — structured logs, filterable by agent/tool/time/trace.
- `/registry` — the single overview: all enabled MCPs + npm packages + LLMs with status & last-used timestamp.
- `/settings` — global permissions, API keys (stored in keychain), backup/restore, telemetry toggle.

---

## 4. Control plane (services/control-plane)

### AgentOrchestrator

Routes messages to the right agent. Handles the main agent + N sub-agents. Sub-agents are separate `Agent` instances with their own system prompt, model, and tool set.

**Sub-agent model (fixing OpenClaw's "super weird" sub-agents):**

- Every sub-agent has a **handle** (e.g. `@coder`, `@email`, `@researcher`).
- Sub-agents can be called explicitly via `@handle` in chat/Telegram, or the main agent can delegate by emitting a `delegate(handle, task)` tool call.
- Every sub-agent runs in its own async context with its own memory scope (can be private or shared — config per agent).
- Sub-agent output always flows back to the caller (main agent or user), never vanishes silently.
- Sub-agents can be nested (a coder can spawn a test-writer), max depth 3 (configurable).

### Critic loop

Before marking any goal done, the orchestrator spins up a **critic** sub-agent with a dedicated system prompt. Critic reads the result, the goal, and relevant memory. It returns either `approve` or `revise <reason>`. If revise, the original agent gets the critique and retries. Max 3 critic loops per goal.

### Tool registry

All tools — native and MCP — register here on startup. Each tool has:

- `id` (stable string)
- `name` (human-readable)
- `description` (LLM-facing)
- `schema` (zod)
- `permissions_required` (array of permission keys)
- `handler(args, ctx)`

The orchestrator never calls a handler directly — it always goes through `PermissionMiddleware.check(toolId, args, ctx)` first.

### CronScheduler + GoalLoop

- **Cron jobs** (`cron_jobs` table) → BullMQ repeatable jobs. When a job fires, it creates a new agent session targeting the configured goal or prompt.
- **Goals** (`goals` table) → a worker picks `status='active'` goals by priority, runs them, updates status. The critic loop is part of "running" a goal.
- **Notifications**: when a cron job or goal completes, the `NotificationRouter` decides where to send the result:
  - If user is active in dashboard → push via SSE.
  - Else → send to default messaging channel (Telegram by default).
  - Each goal can override the notification channel.
  - Agent can be told to stay silent for trivial results (configurable threshold by token count or user rule).

### Watchdog client

Every service emits a heartbeat to the watchdog every 30s. If the watchdog doesn't hear from a service for 90s, it restarts the container and emits a `service.restarted` event that the orchestrator picks up. The orchestrator can then surface this to the user: "Hey, the browser container crashed and I restarted it."

---

## 5. Permission middleware

See `docs/PERMISSIONS.md` for the full spec. Architecturally: a single `check(toolId, args, ctx) → allow | deny | prompt` function that every tool-call pathway must route through. The YAML file is loaded at startup and hot-reloaded on change.

---

## 6. Memory layer

See `docs/CONNECTORS.md#memory` for the provider abstraction.

**Default:** Mem0 OpenMemory in a Docker container. Its REST API is at `http://localhost:8765`, MCP-SSE endpoint at `http://localhost:8765/mcp/open-greg/sse/default`. Postgres + Qdrant as its stores.

**LLM for memory extraction:** Mem0 itself calls an LLM to extract structured facts from raw text. The wizard writes `LLM_PROVIDER` + `LLM_MODEL` env vars into Mem0's compose config:

- If user chose a cloud LLM for the main agent → Mem0 uses the same (cheaper model, e.g., `gpt-4o-mini` or `claude-haiku-4-5`).
- If user chose local-only → Mem0 uses Ollama: `LLM_PROVIDER=ollama`, `LLM_MODEL=<mid-tier model>`, `OLLAMA_BASE_URL=http://ollama:11434`.

We do **not** run Mem0's own UI (`make ui`) — our dashboard's memory browser talks to Mem0's REST API directly to keep UX unified.

**Indexing triggers** (automatic):

- Every chat message (dashboard + Telegram + Discord + Slack + voice).
- Every tool call and result.
- Every connector pull (Gmail threads, GitHub events, calendar updates, CRM rows).
- Every file the agent reads or writes.

**Retrieval:** a `memory.search(query, scope?)` tool the agent can call. Also an implicit pre-prompt retrieval: before each agent turn, the orchestrator grabs the top-N most relevant memories and injects them into the system context.

**Cross-connector knowledge graph:** Mem0's entity-linking handles "client X emailed me about bug in repo Y" by resolving entities across sources. When a new Gmail thread arrives, the extraction pipeline tags entities (people, companies, repos) so later queries can traverse the links.

---

## 7. Computer control

Three independent capabilities, each separately toggleable in permissions:

### 7.1 Shell / filesystem

- `shell.exec(command, cwd?)` — runs via Node `child_process.spawn`. Permission middleware checks `allowed_paths`/`denied_paths` for `cwd` and any path arguments.
- Sudo gate: if permission `filesystem.sudo=true`, the command can include `sudo`. The OS password is fetched from keychain on first use and cached for the session.

### 7.2 Desktop GUI

- **Default (cloud):** Anthropic computer-use tool via the Claude API. Screenshots are captured by the tool itself.
- **Local-LLM fallback:** a Python sidecar using `pyautogui` + `Pillow` + mss for screen capture, combined with a local VLM (Qwen2.5-VL via Ollama) for vision.
- Both implementations expose the same tool interface: `gui.screenshot()`, `gui.click(x,y)`, `gui.type(text)`, `gui.key(key)`, `gui.scroll(dx,dy)`.

### 7.3 Browser control

Three modes, sharing a single browser pool managed by `services/browser-service`:

**Mode A — Scraping:** Playwright headless, no vision. For bulk reads. Fastest. Tool: `browser.scrape(url, selector?)`.

**Mode B — Headless agent:** Playwright headless + periodic screenshot → vision model. For automated flows where the agent needs to see but no human is watching. Tool: `browser.act(goal)` — agent loops: screenshot → decide → click/type → repeat, until goal met or max steps (default 30).

**Mode C — Persistent profile:** Playwright `launchPersistentContext(~/.open-greg/browser-profile/)`. Cookies and logins persist. The Mac Mini stays logged into Gmail etc. Tool: `browser.act(goal, {persistent: true})`.

Vision-loop policy:

- Screenshot every action, not on a timer.
- Max 30 steps per `browser.act` call (configurable).
- If vision cost exceeds 10× scraping equivalent, downgrade to scraping mode and notify.

---

## 8. Voice stack (services/voice-service)

Python FastAPI sidecar.

**STT** — routed by priority:

1. Cloud (if enabled): Deepgram (lowest latency) or Whisper API.
2. Local (default fallback): **Parakeet-tdt-0.6b-v3** via NeMo. Auto-detects language among 25 European languages. Needs only 2GB RAM.
3. Ultra-light fallback: whisper.cpp `base` model. CPU only, slower.

**TTS** — routed by priority:

1. Cloud: ElevenLabs.
2. Local: Piper. One Piper voice per language, preloaded.
3. Fallback: system TTS (`say` on macOS, `espeak-ng` on Linux).

Language detection is **on by default** — the user can set a preferred language or let it auto-detect.

Audio I/O:

- Dashboard sends base64-encoded webm → voice service transcribes → forwards text to control plane.
- Replies route back: text → TTS → base64 mp3 → dashboard plays.
- Telegram voice messages: telegram-webhook → download ogg → voice service → text → agent.
- Agent replies to Telegram as voice if the user sent voice, else as text (configurable).

---

## 9. Vision / OCR (services/vision-service)

Python FastAPI sidecar.

- `describe_image(path_or_url)` → VLM (Claude vision in cloud, Qwen2.5-VL local).
- `ocr(path_or_url, {mode: 'simple'|'layout'})` → Tesseract (simple) or PaddleOCR (layout).
- Same tool works on screenshots from the browser/desktop GUI.

---

## 10. Messaging (packages/messaging/\*)

- **Telegram:** `grammy`. **Long polling by default** (works on any headless machine, no public URL needed). Webhook mode is opt-in and requires a Cloudflare Tunnel or ngrok — wizard helps set this up. Supports group chats with sub-agent handles. Bot is added to group, responds to `@handle` mentions or direct replies. **Never run two processes with the same bot token** — Telegram returns 409. Dev vs prod requires separate bot tokens.
- **Discord:** `discord.js`. Slash commands per agent, threaded.
- **Slack:** `@slack/bolt`. Threaded; each thread = agent session.
- **Email reply-as-trigger:** Gmail MCP polls inbox (label-filtered), new matching emails spawn an agent session. Agent can reply via SMTP (creds in keychain).

All four channels flow into the same message bus in the control plane. The orchestrator doesn't care which channel a message came from.

---

## 11. Connectors / MCP registry

See `docs/CONNECTORS.md` for the full list. Architecturally:

- Each MCP has a `ConnectorDefinition` — id, display name, auth type (OAuth/API-key/token), config schema, default tool allow-list.
- On dashboard "Add connector", the user picks from marketplace or pastes a URL. OAuth flows are handled by a small redirect server inside the control plane at `/oauth/callback/:connector-id`.
- Tokens go to the OS keychain. The connector record in Postgres only stores `status`, `last_used_at`, and non-secret config.

### Registry view (source of truth)

`/registry` page is a single queryable list of:

- All MCPs (enabled/disabled, last used, OAuth status).
- All LLM providers and models (configured, default, fallback).
- All npm packages the agent has `require`'d at runtime (tracked by a wrapper loader).
- All Python packages in the sidecar services (via `pip list` on service start).

Each row has enable/disable, view config, view usage. This is the "list somewhere so we have an overview" feature from the original brief.

---

## 12. Observability

OpenTelemetry traces, metrics, logs. Default exporter: stdout + local SQLite ring buffer for the dashboard log viewer. Optional: OTLP export to user-provided collector (e.g., Gregor's SigNoz at `otel.bluemonkeys.at`). All spans include `agent_id`, `session_id`, `tool_id`, `permission_decision` as attributes.

---

## 13. Crash resilience (fixing OpenClaw's "doesn't know it's crashing")

Three layers:

1. **Docker restart policy** — `restart: unless-stopped` on every service. Kernel-level restart.
2. **Watchdog service** — heartbeats every 30s. 90s silence → restart + log event. Watchdog itself runs with host networking and its own supervisor (launchd/systemd unit) so it doesn't depend on Docker.
3. **Agent self-state awareness** — the agent has a `self.health_check()` tool that queries the watchdog for the status of all services. It can also query `self.recent_errors()` for structured logs of the last N errors. If the agent notices it's stuck in a loop or repeatedly failing a tool, it stops and surfaces a summary to the user instead of spinning forever.

State is always in Postgres — no in-process state that matters. Any agent session can be resumed from `messages` + `tool_calls` tables.

---

## 14. Security boundaries

- Dashboard only binds to `127.0.0.1` by default. LAN exposure requires explicit opt-in + basic auth.
- Control plane only accepts connections from the dashboard and from localhost.
- OS keychain is the only place secrets live at rest.
- Permission middleware is non-bypassable — its absence on a tool path is a P0 bug (CI lint rule enforces it).
- All outbound URLs checked against whitelist if `url_whitelist_mode: true`.
- All shell commands logged with exit code + first 10KB of stdout/stderr.
- Docker containers run as non-root users (except browser/voice where required).

---

_End of ARCHITECTURE.md._
