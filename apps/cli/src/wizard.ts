import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface ClawConfig {
  llm_provider: string
  dashboard_port: number
  control_plane_port: number
  messaging_platform?: string | undefined
  local_llm_tier?: string | undefined
  created_at?: string | undefined
  updated_at?: string | undefined
}

export interface WizardOptions {
  nonInteractive?: boolean | undefined
  configPath: string
  llmProvider?: string | undefined
  dashboardPort?: number | undefined
  controlPlanePort?: number | undefined
  messagingPlatform?: string | undefined
  localLlmTier?: string | undefined
}

const DEFAULTS: ClawConfig = {
  llm_provider: 'anthropic',
  dashboard_port: 3000,
  control_plane_port: 3001,
}

function serializeYaml(obj: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    lines.push(`${k}: ${JSON.stringify(v)}`)
  }
  return lines.join('\n') + '\n'
}

function parseYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue
    const key = trimmed.slice(0, colonIdx).trim()
    const rawVal = trimmed.slice(colonIdx + 1).trim()
    if (!rawVal) continue
    try {
      result[key] = JSON.parse(rawVal)
    } catch {
      result[key] = rawVal
    }
  }
  return result
}

export async function loadConfig(configPath: string): Promise<ClawConfig> {
  if (!existsSync(configPath)) return { ...DEFAULTS }
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = parseYaml(raw)
  return {
    llm_provider: (parsed['llm_provider'] as string) ?? DEFAULTS.llm_provider,
    dashboard_port: (parsed['dashboard_port'] as number) ?? DEFAULTS.dashboard_port,
    control_plane_port:
      (parsed['control_plane_port'] as number) ?? DEFAULTS.control_plane_port,
    messaging_platform: parsed['messaging_platform'] as string | undefined,
    local_llm_tier: parsed['local_llm_tier'] as string | undefined,
    created_at: parsed['created_at'] as string | undefined,
    updated_at: parsed['updated_at'] as string | undefined,
  }
}

export async function runWizard(opts: WizardOptions): Promise<ClawConfig> {
  const existing = await loadConfig(opts.configPath)
  const isNew = !existsSync(opts.configPath)

  const cfg: ClawConfig = {
    ...existing,
    llm_provider: opts.llmProvider ?? existing.llm_provider,
    dashboard_port: opts.dashboardPort ?? existing.dashboard_port,
    control_plane_port: opts.controlPlanePort ?? existing.control_plane_port,
    messaging_platform: opts.messagingPlatform ?? existing.messaging_platform,
    local_llm_tier: opts.localLlmTier ?? existing.local_llm_tier,
    updated_at: new Date().toISOString(),
  }

  if (isNew) cfg.created_at = cfg.updated_at ?? new Date().toISOString()

  const dir = dirname(opts.configPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })

  writeFileSync(opts.configPath, serializeYaml(cfg as unknown as Record<string, unknown>), {
    mode: 0o600,
  })

  return cfg
}
