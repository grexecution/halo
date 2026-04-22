import { NextResponse } from 'next/server'
import { readSettings, writeSettings } from '../settings/store'
import type { LLMModel } from '../settings/store'
import { getDb } from '../../lib/db'
import { ALL_PLUGINS } from '@open-greg/connectors/plugins'

export interface ModelEntry {
  id: string
  name: string
  provider: string
  modelId: string
  available: boolean
  enabled: boolean
  limitTokensPerDay: number
  limitCostPerDay: number
  // Only set for live-discovered Ollama models not yet in settings
  isDiscovered?: boolean
}

const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'

export async function GET() {
  const settings = readSettings()

  // ── 1. Discover live Ollama models ──────────────────────────────────────────
  let liveOllamaNames: string[] = []
  let ollamaReachable = false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      ollamaReachable = true
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      liveOllamaNames = (data.models ?? []).map((m) => m.name)
    }
  } catch {
    // Ollama unreachable — fall through
  }

  // ── 2. Build result from configured models (single source of truth) ─────────
  const result: ModelEntry[] = settings.llm.models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    modelId: m.modelId,
    // Ollama models are available only if Ollama is reachable AND the model tag exists
    available:
      m.provider === 'ollama'
        ? ollamaReachable &&
          liveOllamaNames.some((n) => n === m.modelId || n.startsWith(m.modelId + ':'))
        : (m.enabled ?? true), // cloud models are available if enabled
    enabled: m.enabled ?? true,
    limitTokensPerDay: m.limitTokensPerDay ?? 0,
    limitCostPerDay: m.limitCostPerDay ?? 0,
  }))

  // ── 3. Append discovered Ollama models not already in settings ───────────────
  for (const liveName of liveOllamaNames) {
    const alreadyConfigured = settings.llm.models.some(
      (m) =>
        m.provider === 'ollama' && (m.modelId === liveName || m.modelId === liveName.split(':')[0]),
    )
    if (!alreadyConfigured) {
      result.push({
        id: `ollama-discovered-${liveName.replace(/[^a-z0-9]/gi, '-')}`,
        name: liveName,
        provider: 'ollama',
        modelId: liveName,
        available: true,
        enabled: false, // discovered but not yet explicitly added
        limitTokensPerDay: 0,
        limitCostPerDay: 0,
        isDiscovered: true,
      })
    }
  }

  // ── 4. Append connected AI plugins that expose an LLM endpoint ───────────────
  try {
    const db = getDb()
    const rows = db.prepare('SELECT plugin_id, fields FROM plugin_credentials').all() as Array<{
      plugin_id: string
      fields: string
    }>

    for (const row of rows) {
      const plugin = ALL_PLUGINS.find((p) => p.id === row.plugin_id)
      if (!plugin?.llmMeta) continue

      const { llmMeta } = plugin
      let credentials: Record<string, string> = {}
      try {
        credentials = JSON.parse(row.fields) as Record<string, string>
      } catch {
        continue
      }

      const apiKey = credentials[llmMeta.apiKeyField ?? 'api_key'] ?? ''
      if (!apiKey) continue // no key — skip

      const chosenModel =
        credentials[llmMeta.modelField ?? 'model'] ?? llmMeta.defaultModels[0] ?? ''

      // One entry per connected plugin using the selected/default model
      const entryId = `plugin-${row.plugin_id}`
      const alreadyInSettings = settings.llm.models.some((m) => m.id === entryId)
      if (!alreadyInSettings) {
        result.push({
          id: entryId,
          name: `${plugin.name}${chosenModel ? ` · ${chosenModel}` : ''}`,
          provider: llmMeta.provider,
          modelId: chosenModel,
          available: true,
          enabled: true,
          limitTokensPerDay: 0,
          limitCostPerDay: 0,
        })
      }
    }
  } catch {
    // DB unavailable — skip plugin models
  }

  return NextResponse.json({ models: result, ollamaReachable })
}

// PATCH /api/models — update a single model's settings (enabled, limits, active modelId)
export async function PATCH(req: Request) {
  const body = (await req.json()) as Partial<LLMModel> & { id: string }
  if (!body.id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const settings = readSettings()

  // For plugin-backed models: update the plugin credentials if modelId changed
  if (body.id.startsWith('plugin-') && body.modelId) {
    const pluginId = body.id.slice(7)
    try {
      const db = getDb()
      const row = db
        .prepare('SELECT fields FROM plugin_credentials WHERE plugin_id = ?')
        .get(pluginId) as { fields: string } | undefined
      if (row) {
        const plugin = ALL_PLUGINS.find((p) => p.id === pluginId)
        const modelField = plugin?.llmMeta?.modelField ?? 'model'
        const fields = JSON.parse(row.fields) as Record<string, string>
        fields[modelField] = body.modelId
        db.prepare('UPDATE plugin_credentials SET fields = ? WHERE plugin_id = ?').run(
          JSON.stringify(fields),
          pluginId,
        )
      }
    } catch {
      // non-fatal
    }
  }

  // For settings-backed models: update the settings store
  const inSettings = settings.llm.models.some((m) => m.id === body.id)
  if (inSettings) {
    settings.llm.models = settings.llm.models.map((m) =>
      m.id === body.id
        ? {
            ...m,
            ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
            ...(body.limitTokensPerDay !== undefined
              ? { limitTokensPerDay: body.limitTokensPerDay }
              : {}),
            ...(body.limitCostPerDay !== undefined
              ? { limitCostPerDay: body.limitCostPerDay }
              : {}),
            ...(body.modelId !== undefined ? { modelId: body.modelId } : {}),
          }
        : m,
    )
    writeSettings(settings)
  } else if (body.id.startsWith('plugin-')) {
    // Plugin model not yet in settings — store its overrides (enabled, limits) there
    const pluginId = body.id.slice(7)
    const plugin = ALL_PLUGINS.find((p) => p.id === pluginId)
    if (plugin?.llmMeta) {
      const chosenModel = body.modelId ?? plugin.llmMeta.defaultModels[0] ?? ''
      const existing = settings.llm.models.find((m) => m.id === body.id)
      if (!existing) {
        settings.llm.models.push({
          id: body.id,
          provider: plugin.llmMeta.provider as LLMModel['provider'],
          name: plugin.name,
          modelId: chosenModel,
          enabled: body.enabled ?? true,
          limitTokensPerDay: body.limitTokensPerDay ?? 0,
          limitCostPerDay: body.limitCostPerDay ?? 0,
        })
      } else {
        settings.llm.models = settings.llm.models.map((m) =>
          m.id === body.id
            ? {
                ...m,
                ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
                ...(body.limitTokensPerDay !== undefined
                  ? { limitTokensPerDay: body.limitTokensPerDay }
                  : {}),
                ...(body.limitCostPerDay !== undefined
                  ? { limitCostPerDay: body.limitCostPerDay }
                  : {}),
                ...(body.modelId !== undefined ? { modelId: body.modelId } : {}),
              }
            : m,
        )
      }
      writeSettings(settings)
    }
  }

  return NextResponse.json({ ok: true })
}
