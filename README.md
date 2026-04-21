# claw-alt (working name)

_An open-source, self-hosted, autonomous AI agent platform. The OpenClaw replacement that doesn't crash, has real memory, granular permissions, and actually does autonomous work._

> **Status:** spec phase. Code scaffolding is driven by `BUILD_PROMPT.md` and tracked in `docs/FEATURES.md`.

## Why this exists

OpenClaw has good ideas and serious flaws: weak memory, no granular permissions, crashes without recovering, sub-agents work oddly, autonomy doesn't really autonome. Every painful part is already solved by a well-maintained library somewhere — this project glues them together with a clean permission model on top.

## What this is

- One npm install → dashboard at `localhost:3000`.
- Chat with a main agent or sub-agents (coder, email triager, researcher, critic, your own).
- Real persistent memory, indexed across every channel and connector.
- Full computer control — shell, files, browser (3 modes), desktop GUI — every capability a toggle.
- Runs unattended: cron jobs, goals, self-critique, crash recovery.
- Voice in and out (Parakeet + Piper locally; Deepgram + ElevenLabs in cloud).
- Telegram, Discord, Slack, email.
- Built-in Gmail, GitHub, Calendar, Notion, Linear, HubSpot, Atlassian, Slack.
- MCP-native. Bring any MCP server.

## For humans

- `README.md` (this file) — overview.
- `docs/PHASES.md` — the roadmap.
- `docs/OPEN_DECISIONS.md` — unresolved questions.

## For AI coding agents working on this repo

- `AGENTS.md` — start here.
- `docs/` — the specs.
- `BUILD_PROMPT.md` — how to autopilot the build.

## Install (when built)

```bash
npx create-claw-alt init
```

Wizard walks you through. Under 10 minutes to first conversation.

## Stack

Node 22 · pnpm workspace · Fastify + tRPC · Next.js 15 · Postgres 16 + pgvector · Redis · Docker · Playwright · Ollama · Mem0 OpenMemory · grammy / discord.js / @slack/bolt · NeMo Parakeet v3 · Piper · OpenTelemetry.

Full rationale in `docs/ARCHITECTURE.md`.

## License

TBD — see `docs/OPEN_DECISIONS.md#D-02`.
