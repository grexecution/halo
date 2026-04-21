# Data Model

_Postgres 16 + pgvector. All schemas via Drizzle. Every table below is owned by one service — cross-writes forbidden._

---

## Tables

### `agents`
Owned by: control-plane
```
id              uuid pk
name            text not null
handle          text unique not null         -- e.g. 'coder'
system_prompt   text not null
model           text not null                -- e.g. 'claude-opus-4-7'
fallback_model  text                         -- e.g. 'ollama:qwen2.5:14b'
tools_enabled   jsonb not null default '[]'  -- array of tool ids
permission_scope jsonb                       -- optional overrides of global permissions
parent_agent_id uuid references agents(id)   -- for nested sub-agents
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

### `sessions`
Owned by: control-plane
```
id              uuid pk
agent_id        uuid references agents(id)
channel         text not null  -- 'dashboard' | 'telegram' | 'discord' | 'slack' | 'email' | 'cron'
channel_ref     text            -- e.g. telegram chat_id
parent_session_id uuid references sessions(id)  -- for delegated sub-sessions
status          text not null default 'active'  -- 'active' | 'completed' | 'failed'
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

### `messages`
Owned by: control-plane
```
id              uuid pk
session_id      uuid references sessions(id)
role            text not null  -- 'user' | 'assistant' | 'system' | 'tool'
content         jsonb not null  -- structured content blocks
tool_calls      jsonb          -- array of tool call refs
created_at      timestamptz default now()
INDEX (session_id, created_at)
```

### `tool_calls`
Owned by: control-plane
```
id              uuid pk
message_id      uuid references messages(id)
tool_id         text not null
args            jsonb not null
result          jsonb
allowed_by_policy boolean not null
denial_reason   text
started_at      timestamptz
completed_at    timestamptz
duration_ms     int
trace_id        text
```

### `memories`
Owned by: memory package (delegates to Mem0, but we mirror metadata here for the UI)
```
id              uuid pk
external_id     text unique      -- mem0's id
content         text not null
embedding       vector(1536)     -- pgvector for our own backup retrieval
metadata        jsonb            -- {source_type, source_id, entities, ...}
source_type     text             -- 'message' | 'email' | 'github' | 'calendar' | ...
source_id       text             -- e.g. session_id, email thread id
created_at      timestamptz default now()
```

### `permissions`
Owned by: permissions package
```
id              uuid pk
scope           text not null    -- 'filesystem' | 'network' | 'mcps' | 'tools'
key             text not null    -- e.g. 'sudo', 'url_whitelist_mode'
value           jsonb not null
updated_at      timestamptz default now()
UNIQUE (scope, key)
```

### `connectors`
Owned by: connectors package
```
id              uuid pk
type            text not null    -- 'gmail' | 'github' | 'calendar' | 'custom-mcp' | ...
name            text not null
config          jsonb not null   -- non-secret config only
status          text not null    -- 'connected' | 'disconnected' | 'error'
last_used_at    timestamptz
created_at      timestamptz default now()
```
Tokens live in keychain, never in this table.

### `goals`
Owned by: control-plane
```
id              uuid pk
title           text not null
description     text not null
status          text not null    -- 'pending' | 'active' | 'completed' | 'failed' | 'paused'
priority        int not null default 5  -- 1..10
owner_agent_id  uuid references agents(id)
notification_channel jsonb       -- override routing
last_worked_at  timestamptz
completed_at    timestamptz
notes           text
created_at      timestamptz default now()
```

### `cron_jobs`
Owned by: control-plane
```
id              uuid pk
name            text not null
schedule        text not null    -- cron expression
goal_id         uuid references goals(id)
prompt          text             -- one-shot prompt if not tied to a goal
agent_id        uuid references agents(id)
enabled         boolean default true
last_fired_at   timestamptz
next_fire_at    timestamptz
```

### `events`
Owned by: all services (append-only audit log)
```
id              bigserial pk
type            text not null    -- 'permission.denied' | 'service.restarted' | 'goal.completed' | ...
payload         jsonb not null
service         text not null    -- which service emitted
trace_id        text
created_at      timestamptz default now()
INDEX (type, created_at)
```

### `registry_snapshot`
Owned by: control-plane (refreshed periodically)
```
id              uuid pk
kind            text not null   -- 'mcp' | 'npm' | 'pip' | 'llm'
name            text not null
version         text
status          text            -- 'enabled' | 'disabled' | 'error'
last_seen_at    timestamptz
metadata        jsonb
UNIQUE (kind, name)
```

---

## Migration policy

- Drizzle-kit generates migrations. Review each.
- Never edit a migration after merge — create a new one.
- Destructive migrations (DROP, ALTER TYPE) require a separate PR + the word "DESTRUCTIVE" in title.

## Backup

- `pnpm db:backup` → `~/.claw-alt/backups/YYYY-MM-DD-HHMM.sql.gz`.
- Nightly cron-job backup included in default config (configurable).
- Restore: `pnpm db:restore <file>`.

---

_End of DATA_MODEL.md._
