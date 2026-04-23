<div align="center">

<br />

<img src="https://raw.githubusercontent.com/grexecution/halo/main/docs/assets/halo-banner.svg" width="80" height="80" alt="Halo" />

# Halo

**What OpenClaw should have been.**

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

## What is Halo?

OpenClaw was the dream — a self-hosted AI agent that actually works. It crashed. It forgot things. It never shipped.

Halo is the fix. Self-hosted, always on, real memory, real autonomy. One command on a cheap server and you have a personal AI that codes, browses, automates, chats on Telegram, and learns who you are — running 24/7 on your hardware, not someone else's cloud.

---

## Features

**Autonomous agent**

- Multi-turn chat with 20+ turn memory coherence
- Persistent memory across sessions and server restarts
- 3-layer memory: episodic (raw), semantic (vector search), working (context)
- Learns your preferences and adapts tone, format, and behaviour
- Proactively asks clarifying questions — never just says "ok"

**Tool use**

- Shell execution (permission-gated)
- File read/write
- Browser navigation (Playwright)
- Vision analysis (Claude vision API + Tesseract OCR)
- Code execution in isolated Docker sandboxes
- Sub-agent delegation for complex multi-step tasks

**Automations**

- Cron-scheduled goals that fire on a timer
- Goal loop with stuck-loop detection
- Agent self-repair: detects failures and retries with adjusted approach

**Integrations**

- Telegram ↔ dashboard unified chat (send from either, see in both)
- LiteLLM model routing — route tasks to the best model automatically
- Ollama support for fully local, free AI

**Infrastructure**

- One-command install via `npx create-halo`
- Cloudflare Tunnel for instant public HTTPS URL (no DNS setup, no port forwarding)
- Docker Compose — Postgres, Redis, all services managed automatically
- Login-protected dashboard with session cookies + optional TOTP
- PWA — installable on your phone like a native app
- OpenTelemetry observability built in

---

## Install

### Requirements

- A Linux server (Ubuntu 22.04+ recommended) — **Hetzner CX32, €6.80/mo works great**
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
│  Open the URL and start chatting.                   │
│  Keep this terminal open to maintain the public URL.│
└─────────────────────────────────────────────────────┘
```

Open the URL on any device. You're in.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Dashboard (Next.js 15)             │
│  Chat · Agents · Memory · Goals · Cost · Settings    │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / SSE
┌────────────────────▼─────────────────────────────────┐
│                 Control Plane (Fastify)               │
│  Mastra agent · Tool execution · Memory · Budget      │
└──┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
Postgres   Redis     Browser    Vision
+ pgvector  BullMQ   (Playwright) (Claude API)
```

**Stack:** Node 22 · Next.js 15 · Fastify · Mastra · Vercel AI SDK v6 · Postgres 16 + pgvector · Redis · BullMQ · Playwright · Docker Compose · Cloudflare Tunnel

Full architecture docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## What it can do — live examples

**Chat and remember**

```
You: My server's IP is 192.168.1.100 and I'm running Ubuntu 22.04

Halo: Got it. I'll remember that for whenever you need server commands.

[3 days later, new session]

You: What's my server IP again?
Halo: 192.168.1.100, running Ubuntu 22.04.
```

**Execute code**

```
You: Write and run a Python script that fetches my public IP

Halo: Running it now...
      Your public IP is 85.12.44.201
```

**Automate things**

```
You: Every morning at 8am, check if my website is up and message me on Telegram if it's down

Halo: Done. I've set up a goal that runs at 08:00 daily. I'll ping you if anything's wrong.
```

**Browse and summarise**

```
You: Summarise the top 3 stories on Hacker News right now

Halo: [navigates to news.ycombinator.com]
      Here's what's trending...
```

---

## Hetzner recommended spec

| Server | Price    | RAM   | Use case                        |
| ------ | -------- | ----- | ------------------------------- |
| CX32   | €6.80/mo | 8 GB  | Standard — Anthropic/OpenAI API |
| CX42   | €16/mo   | 16 GB | Local Ollama (llama3.1:8b)      |

> CX32 + Anthropic API is the sweet spot. You get full capability at under €10/month total.

---

## Development

```bash
# Clone
git clone https://github.com/grexecution/halo
cd halo

# Install dependencies (pnpm workspaces)
pnpm install

# Start infrastructure
pnpm -w run docker:up

# Run everything in dev mode
pnpm -w run dev

# Run tests
pnpm test                  # 441 tests
pnpm -w run typecheck      # 0 errors

# Run the live daily test suite against a deployed instance
HALO_BASE_URL=http://your-server:3000 \
HALO_CP_URL=http://your-server:3001 \
npx tsx tests/weekly/runner.ts
```

```
apps/
  cli/          # npx create-halo installer
  dashboard/    # Next.js frontend

services/
  control-plane/  # Fastify API + Mastra agent
  browser-service/
  voice-service/
  vision-service/

packages/
  shared/       # Types, OTel, utilities
  memory/
  messaging/    # Telegram (grammY)
  ...
```

---

## Roadmap

- [ ] Named Cloudflare tunnels with custom domain (e.g. `halo.yourdomain.com`)
- [ ] Mobile push notifications
- [ ] Plugin marketplace
- [ ] Voice mode (Parakeet STT + Piper TTS — local, no API key)
- [ ] Multi-user mode with per-user agents

---

## License

MIT — do whatever you want with it.

---

<div align="center">

Built with too much coffee and a genuine belief that AI agents should run on your hardware, not someone else's.

**[Star on GitHub](https://github.com/grexecution/halo)** if this is useful to you.

</div>
