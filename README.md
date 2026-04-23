<div align="center">

<br />

<img src="https://raw.githubusercontent.com/grexecution/halo/main/docs/assets/halo-banner.svg" width="80" height="80" alt="Halo" />

# Halo

**What OpenClaw should have been. What Hermes still isn't.**

[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Node 22](https://img.shields.io/badge/Node-22_LTS-white.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-441_passing-white.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-white.svg)](#)

<br />

```
npx create-halo
```

_One command. Fresh Ubuntu. Public dashboard URL. Login screen. Done._

<br />

</div>

---

## The problem with the alternatives

**OpenClaw** crashed under load, lost memory between sessions, had no real tool execution pipeline, and was never actually self-hosted — it called home. It was abandoned.

**Hermes** (95k stars) is impressive research but it's a Python monorepo with no install story. No Docker Compose. No dashboard. No Telegram. No memory persistence across restarts. You clone it, edit configs, pray it works. It's a demo, not a product.

**Halo** is neither. It's a production-ready, self-hosted AI agent that installs in one command, runs on a €7/month server, and works the first time.

---

## What Halo actually ships

### 3-layer persistent memory — not a flat log

OpenClaw stored chat history in a file. Hermes keeps a short in-context window. Halo has three real memory layers backed by Postgres + pgvector:

- **Episodic** — every message, timestamped, queryable. Survives restarts.
- **Semantic** — vector embeddings of every interaction. Full similarity search via pgvector. Ask "what did I say about my server last week" and get a real answer.
- **Working** — context window managed automatically. Relevant memories are injected into every prompt, not just the last N messages.

### Honcho user modeling — it learns who you are

Neither OpenClaw nor Hermes had this. Halo builds a profile of you across sessions: your preferences, your goals, your constraints. It adapts its tone, its format, and its assumptions based on what it's learned. This isn't a system prompt — it's a live model that updates after every interaction.

### Autonomous skill generation — it teaches itself

When Halo completes a complex task, it reflects on what it did and stores a reusable skill: a structured description of the tool sequence that worked. Next time a similar task comes up, it pulls the skill instead of figuring it out from scratch. Hermes has a skill concept but no generation loop. OpenClaw had nothing.

### Per-session Docker sandboxing — real isolation

Code execution runs in a fresh Docker container per session. No shared filesystem. No shared process space. The container is torn down after the task. Hermes runs code in the host process. OpenClaw didn't run code at all.

### LiteLLM model routing — use the right model for the job

One API endpoint that routes to Anthropic Claude, OpenAI GPT, or local Ollama based on task type, cost, and availability. If your API key hits a rate limit, it falls back automatically. Hermes hard-codes a single provider. OpenClaw was Claude-only with no fallback.

### Sub-agent orchestration — real parallelism

Complex tasks are decomposed into sub-tasks, each run by a dedicated sub-agent. A critic agent reviews results before they're merged. Halo shows each sub-agent's work in a separate tab in the dashboard. Hermes has sub-agents in theory; in practice it's sequential. OpenClaw had none.

### Live Canvas — real-time collaborative whiteboard

A shared canvas (WebSocket-backed, persisted to Postgres) you can use to plan, diagram, and annotate alongside the agent. Neither OpenClaw nor Hermes has anything like this.

### Telegram ↔ Dashboard unified chat

Send a message from Telegram, see it in the dashboard. Reply in the dashboard, it shows up in Telegram. Full bidirectional sync via SSE. Hermes has no messaging. OpenClaw had a broken Telegram integration that dropped messages.

### OpenTelemetry observability built in

Every agent run emits structured spans. Every tool call is traced. You can see exactly what the agent did, how long each step took, and what it cost — without adding any config. Neither alternative has this.

### One-command install with public URL

```bash
npx create-halo
```

Wizard asks 4 questions, pulls Docker images, starts all services, opens a Cloudflare Tunnel, and prints your login URL. Total time: under 3 minutes. No DNS. No port forwarding. Works on a headless server.

Hermes: clone the repo, edit 3 config files, install Python deps, run it manually, figure out networking yourself.
OpenClaw: abandoned, no install story.

---

## Feature comparison

| Feature | Halo | Hermes | OpenClaw |
|---|---|---|---|
| One-command install | ✅ `npx create-halo` | ❌ manual | ❌ abandoned |
| Public HTTPS URL out of box | ✅ Cloudflare Tunnel | ❌ | ❌ |
| Login-protected dashboard | ✅ + TOTP | ❌ no UI | ❌ |
| Persistent memory (survives restart) | ✅ Postgres + pgvector | ❌ in-memory | ❌ file |
| 3-layer memory (episodic/semantic/working) | ✅ | ❌ | ❌ |
| User preference modeling | ✅ Honcho | ❌ | ❌ |
| Autonomous skill generation | ✅ | partial | ❌ |
| Per-session Docker sandboxing | ✅ | ❌ host process | ❌ |
| LiteLLM model routing + fallback | ✅ | ❌ single provider | ❌ |
| Sub-agent orchestration + critic | ✅ | partial | ❌ |
| Telegram ↔ dashboard sync | ✅ bidirectional | ❌ | broken |
| Browser automation (Playwright) | ✅ | ❌ | ❌ |
| Code execution (isolated) | ✅ Docker sandbox | ❌ | ❌ |
| Vision analysis | ✅ Claude + OCR | ❌ | ❌ |
| Cron goals + stuck-loop detection | ✅ | ❌ | ❌ |
| Live Canvas (collaborative whiteboard) | ✅ | ❌ | ❌ |
| OpenTelemetry observability | ✅ | ❌ | ❌ |
| PWA (installable on phone) | ✅ | ❌ | ❌ |
| Local Ollama fallback | ✅ | partial | ❌ |
| 441 passing tests | ✅ | ❌ | ❌ |

---

## Install

### Requirements

- A Linux server (Ubuntu 22.04+ recommended) — **Hetzner CX32, €6.80/mo is the sweet spot**
- OR your local Mac/Linux machine
- Node.js 22+ (only needed to run the installer — everything else runs in Docker)

### One command

```bash
npx create-halo
```

The wizard asks 4 questions:

```
◆  Halo — self-hosted AI agent
│
◇  How do you want to access the dashboard?
│  ● Public URL (Cloudflare Tunnel — free, no account needed)
│  ○ Local only (localhost:3000)
│
◇  Which LLM do you want to use?
│  ● Anthropic Claude (recommended)
│  ○ OpenAI GPT
│  ○ Local Ollama (free, no API key)
│
◇  Anthropic API key:
│  sk-ant-...
│
◇  Dashboard password (or press Enter for a generated one):
│  ████████
│
◇  Ready to start. Pull images and launch? (~1–3 min)
│  Yes
```

Then it:

1. Pulls Docker images and starts all services
2. Starts a Cloudflare Tunnel for your public URL
3. Bootstraps the login with your password

And prints:

```
┌─────────────────────────────────────────────────────┐
│  Halo is running                                    │
│                                                     │
│  Dashboard: https://abc123.trycloudflare.com        │
│  Username:  admin                                   │
│  Password:  a3f9-d2c1-88ba                         │
│                                                     │
│  Open the URL on any device. You're in.             │
│  Keep this terminal open to maintain the public URL.│
└─────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Dashboard (Next.js 15)             │
│  Chat · Agents · Memory · Canvas · Goals · Cost      │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / SSE / WebSocket
┌────────────────────▼─────────────────────────────────┐
│                 Control Plane (Fastify + Mastra)      │
│  Agent · Tools · Memory · Budget · Sub-agents · DBOS │
└──┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Postgres   Redis      Browser    LiteLLM
+ pgvector  BullMQ   (Playwright)  proxy
```

**Stack:** Node 22 · Next.js 15 · Fastify · Mastra · Vercel AI SDK v6 · Postgres 16 + pgvector · Redis · BullMQ · LiteLLM · Playwright · Docker Compose · Cloudflare Tunnel

---

## Live examples

**Memory that persists**

```
You: My server's IP is 192.168.1.100 — it's running Ubuntu 22.04

Halo: Got it. Stored.

[3 days later, new session]

You: What's my server IP again?
Halo: 192.168.1.100 — Ubuntu 22.04. Want me to SSH in?
```

**Execute code, safely**

```
You: Write and run a Python script that fetches my public IP

Halo: Running in sandbox...
      Your public IP is 85.12.44.201
      [container destroyed]
```

**Autonomous goals**

```
You: Every morning at 8am, check if my site is up. Telegram me if it's down.

Halo: Done. Goal set — runs daily at 08:00.
      I'll ping you on Telegram if anything's wrong.
```

**Model routing in action**

```
You: Analyse this 200-page PDF and summarise it

Halo: Routing to claude-3-5-sonnet (long context, cost-efficient for this task)...
      [summary]
```

---

## Hetzner recommended spec

| Server | Price | RAM | Use case |
|---|---|---|---|
| CX32 | €6.80/mo | 8 GB | Standard — Anthropic/OpenAI API |
| CX42 | €16/mo | 16 GB | Local Ollama (llama3.1:8b, no API key needed) |

> CX32 + Anthropic API is the sweet spot. Full capability for under €10/month.

---

## Development

```bash
git clone https://github.com/grexecution/halo
cd halo
pnpm install
pnpm -w run docker:up   # start Postgres, Redis, LiteLLM
pnpm -w run dev         # dashboard + control plane in watch mode
pnpm test               # 441 tests
pnpm -w run typecheck   # 0 errors
```

```
apps/
  cli/            # npx create-halo installer
  dashboard/      # Next.js 15 frontend

services/
  control-plane/  # Fastify API + Mastra agent + DBOS
  browser-service/
  voice-service/
  vision-service/

packages/
  shared/         # Types, OTel, utilities
  messaging/      # Telegram (grammY)
  memory/         # 3-layer memory abstraction
  ...
```

---

## Roadmap

- [ ] Named Cloudflare tunnels with custom domain (`halo.yourdomain.com`)
- [ ] Voice mode — Parakeet STT + Piper TTS, fully local
- [ ] Multi-user mode with per-user agents and permission scopes
- [ ] Plugin marketplace

---

## License

MIT — do whatever you want with it.

---

<div align="center">

Built because OpenClaw crashed one too many times.

**[Star on GitHub](https://github.com/grexecution/halo)** if this is useful to you.

</div>
