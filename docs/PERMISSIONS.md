# Permissions

_Every capability is a toggle. Default to least privilege. Whitelist, not blacklist._

---

## The YAML

Source of truth at `~/.claw-alt/permissions.yml`. Hot-reloaded on change (chokidar).

```yaml
# Filesystem
filesystem:
  read: true
  write: true
  sudo: false                    # if true, keychain password is used
  allowed_paths:
    - ~/Projects
    - ~/Documents/work
  denied_paths:                  # always denied even if under an allowed path
    - ~/.ssh
    - ~/.aws
    - ~/.gnupg
    - ~/.claw-alt/secrets

# Network
network:
  internet: true
  url_whitelist_mode: false      # if true, only allowed_urls work
  allowed_urls:                  # glob patterns
    - "*.bluemonkeys.com"
    - "github.com"
    - "api.github.com"
    - "mail.google.com"
    - "api.anthropic.com"
  denied_urls:
    - "*.bank.*"
    - "*.gov"

# MCPs
mcps:
  enabled: [gmail, github, calendar]
  disabled: []
  require_confirmation: [gmail-send, github-push]   # prompt before each call

# LLM providers
llm:
  allowed_providers: [anthropic, openai, ollama]
  allow_model_switching: true

# Native tools
tools:
  shell: true
  shell_sudo: false              # independent of filesystem.sudo (sudo on commands)
  fs_read: true
  fs_write: true
  browser_scrape: true
  browser_act: true              # headless agent mode
  browser_persistent: true       # logged-in profile mode
  computer_use: true             # desktop GUI control
  voice_in: true
  voice_out: true

# Autonomy
autonomy:
  cron_allowed: true
  goal_loop_allowed: true
  agent_can_self_schedule: true  # agent can create its own cron jobs
  agent_can_spawn_subagents: true
  max_subagent_depth: 3

# Messaging
messaging:
  telegram: true
  discord: false
  slack: false
  email_reply: true
  default_notification_channel: telegram
```

Missing keys inherit defaults (conservative).

---

## The middleware

Every tool call routes through:

```ts
const decision = await permissions.check(toolId, args, ctx);
// decision: { allow: true } | { allow: false, reason: string } | { prompt: string }
```

- `allow: true` → call proceeds.
- `allow: false` → call returns `{ ok: false, error: { type: 'permission', reason } }` to the agent, emits `permission.denied` event.
- `prompt: "..."` → dashboard shows a prompt, user allows/denies, decision cached for this session.

The middleware also:
- Expands `~` paths.
- Normalizes URLs (lowercasing host, resolving redirects).
- Logs every decision to the `events` table.

## Static guarantees

- **Lint rule `no-bypass-permission`** forbids calling tool handlers directly. Any new tool must be registered via `defineTool()`, which is what the middleware hooks into. CI blocks PRs that violate this.
- **Type-level guard:** `ToolHandler<T>` is not exported; only `defineTool()` accepts handlers, wrapping them.

## Panic button

Dashboard button → control-plane endpoint → writes `global_panic: true` → all in-flight tool calls aborted → all permissions effectively `false` until a second button press clears it. Emits a `panic.triggered` event.

## Sudo flow

1. `filesystem.sudo: false` by default.
2. User toggles to `true` in dashboard.
3. First tool call requiring sudo triggers an OS password prompt (via keychain-prompt). Password stored in keychain, cached in memory for the session.
4. Password never touches disk, never logs.
5. Dashboard shows a persistent "sudo active" banner.

## URL whitelist

- Glob patterns. `*.example.com` matches subdomains. `example.com` matches exactly.
- Checked against the fully-resolved final URL (after following redirects).
- Applies to all network tools: browser, http-fetch, MCP calls to arbitrary URLs.
- MCPs with pre-registered domains are allowed by default (e.g. Gmail MCP's Google endpoints).

## Confirmation flow

Some tools have `require_confirmation`. First call in a session prompts the user. User can choose:
- Allow once
- Allow for this session
- Always allow (updates YAML)
- Deny once
- Always deny (updates YAML)

## Audit

- Every permission decision logged to `events` table with `type: 'permission.decision'`.
- `/logs` in the dashboard has a "permissions" tab filtering these.
- Weekly summary of denials available via a default cron job (configurable).

---

## Budgets

A permission toggle isn't enough — a looping agent can burn $100 before you notice. Every session has hard budgets.

```yaml
budgets:
  per_session:
    max_tokens: 500000        # input + output combined
    max_cost_usd: 5.00
    max_tool_calls: 200
    max_wall_time_seconds: 3600
  per_day:
    max_cost_usd: 50.00       # hard stop — agent refuses new work after hit
    soft_warn_cost_usd: 20.00 # dashboard banner
```

Enforcement:
- Control-plane tracks running totals in Redis (per-session) + Postgres (per-day).
- Before every LLM call, check: `projected_cost(prompt_tokens + max_output_tokens) > remaining_budget` → deny.
- On hit: emit `budget.exceeded` event, abort session, notify user via default channel.
- Dashboard shows live budget gauges per session and global daily spend.

Cost per token by model is in `packages/shared/pricing.ts` — keep up to date.

---

## Approval flow

Some actions are too dangerous for pure permission toggles. They require explicit approval per-call:

```yaml
approval_required:
  - email.send
  - git.push
  - fs.delete_many          # >5 files or recursive
  - filesystem.sudo_exec
  - connector.remove
  - budget.override         # user raising the cap mid-session
```

Flow:
1. Tool handler checks approval list.
2. If in list: emit `approval.requested` event with diff/summary.
3. Dashboard shows a modal; Telegram sends an inline-button message ("Allow / Deny / Allow for session").
4. User responds within timeout (default 5 min). No response = deny.
5. Agent sees `{ok: false, error: "awaiting approval"}` or `{ok: true, ...}` depending on user response.

Approvals logged. "Allow for session" cached in Redis with session-scoped TTL.

---

## Timeouts

Every tool call has a timeout. No indefinite awaits — an LLM that `await`s a hung browser forever is how OpenClaw "goes idle."

Defaults (tool-id → timeout):
```yaml
tool_timeouts:
  default: 60
  browser.act: 300           # 5 min for multi-step flows
  shell.exec: 120
  llm.call: 120
  mcp.*: 45
```

Configurable in YAML. Orchestrator uses `AbortController` + `setTimeout` pattern. On timeout: tool returns `{ok: false, error: "timeout"}`, no hang.

---

## Secrets storage

Default: OS keychain via `keytar` — macOS Keychain or Linux `libsecret`/`gnome-keyring`.

**Headless-Linux fallback** (no keyring daemon): AES-256-GCM encrypted file at `~/.claw-alt/secrets.enc`. Passphrase from env var `CLAW_SECRET_PASSPHRASE` (required at service start — fails fast if missing). Wizard generates a random passphrase on first run and prints it once for the user to store.

Detection: on startup, try keytar — if it throws "could not connect to keyring" (common on headless Debian/Ubuntu), fall back. Log which backend is active.

Never:
- Log secrets (even at debug level — pino redaction lists configured).
- Include secrets in OTel spans (redaction rule in `packages/telemetry`).
- Commit `~/.claw-alt/secrets.enc` (it's under the user home, not the repo, but belt-and-braces).

---

_End of PERMISSIONS.md._
