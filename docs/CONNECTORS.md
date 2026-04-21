# Connectors & Integrations

_All the external systems we plug into. Add new entries here when adding new integrations. Keep this in sync with the registry page._

---

## LLM providers

| ID | Provider | Default model | Auth | Status |
|---|---|---|---|---|
| `anthropic` | Anthropic | `claude-opus-4-7` | API key (keychain) | built-in |
| `openai` | OpenAI | `gpt-4o` | API key | built-in |
| `google` | Google Gemini | `gemini-2.5-pro` | API key | built-in |
| `groq` | Groq | `llama-3.3-70b` | API key | built-in |
| `ollama` | Ollama (local) | depends on install | none | built-in |
| `openrouter` | OpenRouter | any | API key | built-in |

**Local LLM tiers (Ollama):**
- **Weak:** `qwen2.5:3b` (~2GB RAM)
- **Mid:** `qwen2.5:14b` (~10GB RAM, Mac Mini M4 works)
- **Strong:** `qwen2.5:32b` or `llama3.3:70b` (needs real GPU or Mac Studio)

**Routing policy** (per agent):
- Primary → fallback on: rate-limit, 5xx, timeout >30s, offline.
- Configurable per agent in the Agents page.

---

## Memory providers

| ID | Provider | Transport | Default? |
|---|---|---|---|
| `mem0` | Mem0 OpenMemory (local) | MCP-SSE | ✅ |
| `hindsight` | Hindsight (local) | MCP-HTTP | optional |

Both run as Docker containers. Swappable via settings → memory.

---

## MCPs (built-in)

| ID | Auth | Key tools |
|---|---|---|
| `gmail` | OAuth 2 | list, read, send, search, label |
| `gcal` | OAuth 2 | list events, create, update, delete |
| `gdrive` | OAuth 2 | list, read, write, share |
| `github` | OAuth or PAT | repos, issues, PRs, commits, actions |
| `slack` | OAuth | channels, messages, users, threads |
| `notion` | OAuth | pages, databases, search |
| `linear` | OAuth | issues, projects, comments |
| `asana` | OAuth | tasks, projects, workspaces |
| `hubspot` | OAuth | contacts, deals, companies |
| `atlassian` | OAuth | Jira issues, Confluence pages |

Custom MCPs: Connectors page → "Add custom MCP" → paste URL + auth config.

---

## Voice providers

**STT:**
| ID | Provider | Local? | Languages |
|---|---|---|---|
| `parakeet-v3` | NVIDIA Parakeet-tdt-0.6b-v3 | ✅ | 25 EU, auto-detect |
| `whisper-cpp` | whisper.cpp `base` | ✅ | 99, slower |
| `deepgram` | Deepgram Nova | cloud | many |
| `whisper-api` | OpenAI Whisper API | cloud | 99 |

**TTS:**
| ID | Provider | Local? | Voices |
|---|---|---|---|
| `piper` | Piper | ✅ | 40+ languages, one voice each |
| `kokoro` | Kokoro TTS | ✅ | high quality, needs more RAM |
| `elevenlabs` | ElevenLabs | cloud | premium |
| `system-say` | macOS `say` / `espeak-ng` | ✅ | fallback |

---

## Vision providers

| ID | Provider | Local? | Purpose |
|---|---|---|---|
| `claude-vision` | Claude vision API | cloud | description + VQA |
| `qwen-vl` | Qwen2.5-VL via Ollama | ✅ | description + VQA (local) |
| `tesseract` | Tesseract | ✅ | OCR simple |
| `paddleocr` | PaddleOCR | ✅ | OCR layout, multilingual |

---

## Messaging channels

| ID | Library | Auth |
|---|---|---|
| `telegram` | grammy | bot token + webhook or long-poll |
| `discord` | discord.js | bot token |
| `slack` | @slack/bolt | OAuth + events subscription |
| `email` | nodemailer (send) + Gmail MCP (receive) | SMTP creds + OAuth |

---

## Connector config schema

Every connector defines:
```ts
{
  id: string;
  displayName: string;
  category: 'llm' | 'memory' | 'mcp' | 'voice-stt' | 'voice-tts' | 'vision' | 'messaging';
  auth: 'none' | 'apikey' | 'oauth' | 'bot-token';
  configSchema: ZodSchema;    // non-secret config
  credentialKeys: string[];   // names of secrets to store in keychain
  tools?: ToolDefinition[];   // for MCPs
  setup: (config) => Promise<void>;  // called on enable
  teardown: () => Promise<void>;     // called on disable
  healthCheck: () => Promise<'ok' | 'error' | 'unknown'>;
}
```

Adding a new built-in connector = one file in `packages/connectors/src/providers/<id>.ts` that exports the above.

---

## Adding a connector for which no MCP exists

Two fallback paths:

1. **Browser automation recording (F-106)** — click through the flow once, Playwright records. Replays on demand. Best for SaaS without APIs.
2. **Raw HTTP MCP** — write a thin MCP server (20–50 lines in Node) exposing the target API. Register as custom MCP.

---

## MCP integration notes

- Use `@ai-sdk/mcp` from AI SDK v6 (stable, includes OAuth/PKCE/token refresh, resources, prompts, elicitation).
- Prefer vendoring tool definitions from frequently-used MCPs via `mcp-to-ai-sdk` for production — reduces token overhead (GitHub MCP alone uses ~50k tokens for tool definitions) and prevents schema drift. Dynamic loading is fine for development.
- Tool call outputs must always be treated as untrusted input — pass through a sanitizer before injection into the next prompt.

---

_End of CONNECTORS.md._
