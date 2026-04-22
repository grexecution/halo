# Runbook

_What to do when things break. Known failure modes with recovery steps. Read this when stuck before asking for help._

---

## Install-time failures

### "keytar is not installed" / "Could not connect to keyring"

You're on headless Linux without `libsecret`/`gnome-keyring`.

**Fix:** set `GREG_SECRET_PASSPHRASE` to a strong random string in your shell before re-running the wizard. The wizard detects keytar failure and offers this path automatically, but if you skipped the prompt:

```bash
export GREG_SECRET_PASSPHRASE="$(openssl rand -base64 32)"
echo "export GREG_SECRET_PASSPHRASE='$GREG_SECRET_PASSPHRASE'" >> ~/.bashrc
npx create-open-greg init
```

Do not lose the passphrase — it decrypts your stored credentials.

### `docker compose up` hangs on Ollama pull

First-run model download can be 4–40GB. Not hung, just slow. Check progress:

```bash
docker logs -f open-greg-ollama
```

If the disk is full, `docker system prune` + `docker volume prune` before retrying.

### Mem0 OpenMemory container exits with "OPENAI_API_KEY is required"

Mem0 needs an LLM for fact extraction. You either:

- Didn't pick an LLM in the wizard. Re-run `npx create-open-greg init` and pick one.
- Picked "local only" but Ollama isn't ready yet. Wait for Ollama's health check; Mem0 restarts automatically.

### PaddleOCR or NeMo wheel install fails on arm64

These have arm64 wheels but not always for every Python patch version. The voice-service Dockerfile pins Python 3.11 specifically. If it still fails:

```bash
# Skip voice/vision at install time
npx create-open-greg init --skip-optional
```

Voice and vision can be added later via the dashboard.

---

## Runtime failures

### Telegram: "409: Conflict: terminated by other getUpdates request"

Two processes are polling with the same bot token.

**Cause:** dev and prod both running, or a leftover process from a previous crash.
**Fix:**

```bash
pnpm pm:status       # see running agents
pnpm pm:stop telegram
# then restart only one
```

**Prevention:** use separate bot tokens for dev (`BOT_TOKEN_DEV`) and prod.

### Agent loops on a failing tool

The stuck-loop detector (F-141) should catch this, but if it doesn't:

1. Hit **Panic** in the dashboard.
2. Check `logs` → filter by `tool_id`.
3. The usual cause: tool returns success but with a meaningless result the agent can't make progress with. Check the tool's return value.
4. Add a regression test under the tool's feature ID.

### Browser service crashes mid-`browser.act`

Watchdog restarts it within 90s. Agent gets `{ok: false, error: "service_unavailable"}` and reports to user. If it keeps crashing:

```bash
docker logs -f open-greg-browser
```

Most common causes:

- OOM — raise memory limit in `docker/compose.yml`.
- Playwright version mismatch after an update — `pnpm install` in `services/browser-service`.
- User's persistent profile got corrupted — `rm -rf ~/.open-greg/browser-profile` and re-login.

### Budget exceeded mid-conversation

Session aborts cleanly, event logged, user notified. To increase:

- Temporary (this session only): raise via dashboard "Session budget" input.
- Permanent: edit `~/.open-greg/permissions.yml` → `budgets` section.

### "Missing permission: tools.shell_sudo" on a command that doesn't need sudo

The shell parser matches `sudo` at start of command. If you have an alias, it's evaluated _before_ the parser. Best not to use aliased sudo in tool commands. Use `/usr/bin/sudo` explicitly if needed.

### OAuth redirect fails with "localhost not accessible"

Default is `http://localhost:4000/oauth/callback/<connector>`. Some providers (Notion, some Google scopes) require HTTPS.

**Fix:** run `pnpm tunnel` which starts a Cloudflare Tunnel pointing at the control plane and registers the new URL with the connector provider automatically. Persist the tunnel URL in `~/.open-greg/config.yml`.

### Dashboard shows "Control plane unreachable"

1. `docker ps | grep control-plane` — is it running?
2. `docker logs open-greg-control-plane` — errors?
3. If healthy but not reachable, check if port 4000 is occupied: `lsof -i :4000`.
4. Restart: `pnpm docker:restart control-plane`.

### Feature test fails nondeterministically

Likely LLM flakiness. Rerun once. If it still fails:

- Check the assertion — are you matching exact text? Switch to behavior assertion (see `docs/TESTING.md#handling-llm-non-determinism`).
- Is the mock LLM response stale? Regenerate fixtures: `pnpm test:features --update-fixtures`.
- Is a real API being called where mock was expected? `INTEGRATION=1` env var leaked — unset it.

---

## Data recovery

### Accidentally deleted an agent

Agents are soft-deleted. Restore:

```sql
UPDATE agents SET deleted_at = NULL WHERE id = '<uuid>';
```

### Corrupted memory

Memories are append-only in Mem0. To rebuild from source data:

```bash
pnpm memory:rebuild
```

This re-indexes from `messages`, `events`, and enabled connector history.

### Lost keychain passphrase

**No recovery.** This is cryptographically impossible by design. You must:

1. Re-run OAuth flows for every connector.
2. Re-enter every API key.
3. Generate a new `GREG_SECRET_PASSPHRASE`.

**Prevention:** back up the passphrase in a password manager the moment the wizard prints it.

### Database migration stuck

Drizzle migrations are transactional. If one fails partway:

```bash
pnpm db:migrate:status    # see which ones applied
pnpm db:migrate:rollback  # revert last
# fix the migration file, regenerate if needed
pnpm db:migrate
```

Never delete a migration that's been applied to another machine's DB.

---

## Upgrading

### From v0.x to v0.(x+1)

```bash
npx create-open-greg upgrade
```

This:

1. Backs up DB to `~/.open-greg/backups/pre-upgrade-YYYYMMDD.sql.gz`.
2. Pulls new Docker images.
3. Runs migrations.
4. Restarts services one at a time.

If migration fails, restore:

```bash
pnpm db:restore ~/.open-greg/backups/pre-upgrade-YYYYMMDD.sql.gz
```

---

## Performance

### First-turn latency > 10s

- Cloud LLM: check network latency (DNS issues, firewall).
- Local LLM: the model might not be loaded into GPU memory. First call warms it. Second should be fast.
- If consistently slow, check `llm.call.duration_ms` metric in `/logs` filtered by `tool_id=llm.call`.

### Memory search slow

Qdrant query > 200ms usually means an index issue. Check:

```bash
docker exec open-greg-qdrant curl localhost:6333/collections/openmemory
```

Ensure `indexed_vectors_count` == `vectors_count`.

---

## When to reset everything

Full nuke and restart:

```bash
pnpm docker:down --volumes          # drops Postgres data!
rm -rf ~/.open-greg                   # drops keychain fallback + profiles
# keytar entries remain; remove manually if needed
npx create-open-greg init
```

This is a last resort. Back up `~/.open-greg/backups/` first if you want to keep memories.

---

_End of RUNBOOK.md._
