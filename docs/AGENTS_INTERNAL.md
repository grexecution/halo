# Internal Agents

_How the orchestrator runs multiple agents. This is not about AI coding-assistant agents — this is about the agents the product itself runs._

---

## Core shape

Every agent is a row in the `agents` table plus a runtime `Agent` instance:

```ts
class Agent {
  id: string;
  handle: string;          // e.g. 'coder' — used for @mentions
  systemPrompt: string;
  model: string;
  fallbackModel?: string;
  tools: Tool[];           // resolved from tools_enabled
  permissions: PermissionScope;  // merged global + overrides
  parentId?: string;
}
```

Agents are created by the user via the Agents page or automatically by the wizard.

---

## Default agents (shipped out of the box)

1. **`main` ("Claw")** — generalist. Handles all messages by default. Has access to all enabled tools. Can delegate.
2. **`coder`** — coding tasks. Has shell, fs, git, GitHub MCP. System prompt emphasizes reading before writing, running tests before claiming done.
3. **`email`** — inbox triage. Has Gmail MCP, calendar. System prompt for concise summaries and reply drafts.
4. **`researcher`** — web research. Has browser scraping + web search. System prompt for source citations.
5. **`critic`** — used by the critic loop. System prompt: identify bugs, security issues, simpler alternatives, missing tests.

All editable in the UI.

---

## Delegation

Main agent can delegate to sub-agents via a `delegate` tool:

```ts
delegate({ handle: 'coder', task: 'fix the typo in src/utils/date.ts' })
→ spawns a sub-session with parent_session_id = current session
→ sub-agent runs its own turn loop with its own tools + permissions
→ returns final message to the caller
→ caller integrates result into its next response
```

Max nesting: 3 levels (configurable). Prevents runaway spawning.

## Mentions

In chat (dashboard or Telegram group), `@handle ...` bypasses main agent:
- Dashboard: the tab switches or opens a sub-agent tab.
- Telegram group: the sub-agent replies directly in the group thread.
- Slack: sub-agent replies in the thread.

Ambiguity rule: if multiple agents have the same handle (shouldn't, but), the first-created wins.

## Critic loop

```
goal → agent attempt → critic review → approve | revise
                          ↑               ↓
                          └──── revision cycle (max 3) ────┘
```

Critic has:
- the goal description
- the agent's attempt (messages + tool calls)
- relevant memories

Critic's system prompt is short and sharp. Output format: `{ verdict: 'approve' | 'revise', reason: string }`. Structured output enforced.

Critic is used for:
- goal-loop worker completions (every goal)
- opt-in for main-agent user-facing responses (toggle per agent)
- never for trivial turns like "hi"

Skip criteria: output length <N tokens, or critic.disabled=true on the agent.

## Context isolation

Each sub-agent has its own memory scope by default:
- **Private** — only sees memories tagged with its own agent_id.
- **Shared** — sees all memories (main agent default).
- **Shared-read, private-write** — can read the main store but writes go to its own scope.

Configured per-agent in the Agents page.

## Session lifecycle

1. Message in → orchestrator resolves target agent (via handle or default).
2. Create or resume session row.
3. Load recent messages + pre-prompt memory injection.
4. Run turn loop (Vercel AI SDK):
   - LLM call with tools.
   - Tool calls → middleware → handlers → results.
   - Repeat until no more tool calls or max steps (default 25).
5. Stream to client. Write messages to DB.
6. If delegation happened, resolve sub-session results before final response.
7. If this was a goal, run critic.
8. Emit `session.completed` event.

## Self-awareness tools

Every agent has these by default (no permission needed to check; acting on results still requires permissions):

- `self.health_check()` → status of all services.
- `self.recent_errors(n?)` → last N errors from `events`.
- `self.list_goals()` → goals assigned to me.
- `self.list_cron_jobs()` → cron jobs tied to me.
- `self.stuck_detector()` → has my last N turns made progress? (implemented via LLM judge on message deltas)

The orchestrator injects a note into the system prompt if `stuck_detector` returns true: *"Your last 3 turns made no observable progress. Step back: summarize where you are, ask the user for input, or change strategy."*

---

_End of AGENTS_INTERNAL.md._
