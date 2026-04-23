/**
 * setup-store.ts — persists LLM keys + Telegram token to ~/.open-greg/settings.json
 *
 * This is the single source of truth for runtime-configurable settings.
 * The control-plane reads these on startup; changes take effect on next restart
 * (or after calling resetAgent()).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DIR = join(homedir(), '.open-greg')
const SETTINGS_PATH = join(DIR, 'settings.json')

export interface AppSettings {
  llm: {
    provider: 'anthropic' | 'openai' | 'ollama'
    anthropicKey?: string | undefined
    openaiKey?: string | undefined
    ollamaModel?: string | undefined
    anthropicModel?: string | undefined
  }
  telegram?: {
    botToken: string
    allowedChatIds?: number[] | undefined
  }
  setupComplete: boolean
}

const DEFAULTS: AppSettings = {
  llm: { provider: 'ollama' },
  setupComplete: false,
}

export function loadSettings(): AppSettings {
  if (!existsSync(SETTINGS_PATH)) return { ...DEFAULTS }
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const s: AppSettings = {
      llm: parsed.llm ?? DEFAULTS.llm,
      setupComplete: parsed.setupComplete ?? false,
    }
    if (parsed.telegram) s.telegram = parsed.telegram
    return s
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: AppSettings): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true, mode: 0o700 })
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), { mode: 0o600 })
}

export function isSetupComplete(): boolean {
  return loadSettings().setupComplete
}

export function applyEnvFromSettings(): void {
  const s = loadSettings()
  if (s.llm.anthropicKey) process.env['ANTHROPIC_API_KEY'] = s.llm.anthropicKey
  if (s.llm.openaiKey) process.env['OPENAI_API_KEY'] = s.llm.openaiKey
  if (s.llm.provider) process.env['LLM_PROVIDER'] = s.llm.provider
  if (s.llm.ollamaModel) process.env['OLLAMA_MODEL'] = s.llm.ollamaModel
}
