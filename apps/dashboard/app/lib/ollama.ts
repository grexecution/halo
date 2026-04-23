/** Shared Ollama utilities. Centralises all Ollama reachability + model resolution logic. */
import { OLLAMA_DEFAULT_MODEL, OLLAMA_URL } from './env'

export interface OllamaModel {
  name: string
  modified_at?: string
  size?: number
}

/** Fetch the list of available Ollama models. Returns [] if Ollama is unreachable. */
export async function getOllamaModels(timeoutMs = 3000): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { models?: OllamaModel[] }
    return data.models ?? []
  } catch {
    return []
  }
}

/**
 * Resolve the best available Ollama model name.
 * Tries exact match → prefix match (with tag) → first available → fallback default.
 */
export async function resolveOllamaModel(preferred = OLLAMA_DEFAULT_MODEL): Promise<string> {
  const models = await getOllamaModels()
  if (models.some((m) => m.name === preferred)) return preferred
  const prefix = models.find((m) => m.name.startsWith(preferred + ':'))
  if (prefix) return prefix.name
  if (models.length > 0) return models[0]!.name
  return preferred
}

/** Call Ollama chat (non-streaming). Returns the assistant message content. */
export async function callOllama(
  messages: Array<{ role: string; content: string }>,
  model?: string,
): Promise<string> {
  const resolvedModel = model ?? (await resolveOllamaModel())
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: resolvedModel, messages, stream: false }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { message?: { content: string } }
  return data.message?.content ?? '(no response)'
}

/** Call Anthropic Messages API (non-streaming). Returns the assistant message content. */
export async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model = 'claude-haiku-4-5-20251001',
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1024, messages }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text: string }> }
  return data.content?.find((c) => c.type === 'text')?.text ?? '(no response)'
}
