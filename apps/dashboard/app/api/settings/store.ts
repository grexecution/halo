import { getDb } from '../../lib/db'

export interface LLMModel {
  id: string
  provider: 'ollama' | 'anthropic' | 'openai' | 'z.ai' | 'custom'
  name: string
  modelId: string
  apiKey?: string
  baseUrl?: string
  // Usage controls (all optional — omit = unlimited)
  enabled?: boolean // default true
  limitTokensPerDay?: number // hard cap on tokens/day (0 = unlimited)
  limitCostPerDay?: number // hard cap in USD/day (0 = unlimited)
}

export interface Settings {
  llm: { primary: string; models: LLMModel[] }
  vision: { provider: 'local' | 'cloud'; model: string }
  stt: { provider: 'local' | 'cloud'; model: string }
  tts: { provider: 'local' | 'cloud'; model: string; voice?: string }
  permissions: {
    sudoEnabled: boolean
    urlWhitelistMode: boolean
    allowedUrls: string[]
    blockedUrls: string[]
    toolsEnabled: Record<string, boolean>
  }
  telemetry: { enabled: boolean; otelEndpoint: string }
  memory: {
    // 'auto'     = use ANTHROPIC_API_KEY if set, else fall back to local Ollama
    // 'disabled' = turn ObservationalMemory off entirely
    // <model.id> = use a specific model from llm.models
    observationModelId: string
    fallbackModelId?: string
  }
}

export const DEFAULT_SETTINGS: Settings = {
  llm: {
    primary: 'ollama-default',
    models: [
      {
        id: 'ollama-default',
        provider: 'ollama',
        name: 'Llama 3.2 (local)',
        modelId: 'llama3.2',
        enabled: true,
      },
    ],
  },
  vision: { provider: 'local', model: 'paddleocr' },
  stt: { provider: 'local', model: 'parakeet' },
  tts: { provider: 'local', model: 'piper', voice: 'en_US-lessac-medium' },
  permissions: {
    sudoEnabled: false,
    urlWhitelistMode: false,
    allowedUrls: [],
    blockedUrls: [],
    toolsEnabled: { shell: false, browser: true, filesystem: false, gui: false },
  },
  telemetry: { enabled: false, otelEndpoint: '' },
  memory: { observationModelId: 'auto' },
}

export function readSettings(): Settings {
  const db = getDb()
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined
  if (!row) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(row.data) as Partial<Settings>
    // Deep merge so new fields get defaults even for old stored data
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      memory: { ...DEFAULT_SETTINGS.memory, ...(parsed.memory ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function writeSettings(settings: Settings): void {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(
    JSON.stringify(settings),
  )
}
