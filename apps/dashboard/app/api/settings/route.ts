import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

interface LLMModel {
  id: string
  provider: 'ollama' | 'anthropic' | 'openai' | 'custom'
  name: string
  modelId: string
  apiKey?: string
  baseUrl?: string
}

interface Settings {
  llm: {
    primary: string
    models: LLMModel[]
  }
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
}

const DEFAULT_SETTINGS: Settings = {
  llm: {
    primary: 'ollama/llama3.2',
    models: [
      {
        id: 'ollama-default',
        provider: 'ollama',
        name: 'Llama 3.2 (local)',
        modelId: 'llama3.2',
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
}

function getDataDir(): string {
  return resolve(homedir(), '.open-greg')
}

function ensureDataDir(): void {
  const dir = getDataDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getSettingsPath(): string {
  return resolve(getDataDir(), 'settings.json')
}

function readSettings(): Settings {
  const path = getSettingsPath()
  if (!existsSync(path)) return DEFAULT_SETTINGS
  try {
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as Settings
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function GET() {
  try {
    const settings = readSettings()
    return NextResponse.json(settings)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Settings
    ensureDataDir()
    writeFileSync(getSettingsPath(), JSON.stringify(body, null, 2), 'utf-8')
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
