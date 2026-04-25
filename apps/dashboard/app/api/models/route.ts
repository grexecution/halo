export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readSettings, writeSettings } from '../settings/store'
import type { LLMModel } from '../settings/store'
import { getDb } from '../../lib/db'
import { ALL_PLUGINS } from '@open-greg/connectors/plugins'
import { getOllamaModels } from '../../lib/ollama'

// ── Helper: derive a human-readable label from a raw model ID ────────────────
// Examples:
//   "kimi-k2.5"         → "K2.5"
//   "kimi-k2-thinking"  → "K2 Thinking"
//   "moonshot-v1-8k"    → "Moonshot 8K"
//   "deepseek-chat"     → "Chat"
//   "grok-4"            → "Grok 4"
//   "mistral-large-latest" → "Large"
function modelIdToLabel(modelId: string): string {
  // Strip known prefix tokens that just duplicate the provider name
  const prefixesToStrip = [
    'moonshot-v1-',
    'kimi-',
    'deepseek-',
    'mistral-',
    'codestral-',
    'open-mistral-',
    'grok-',
    'llama-',
    'gemma',
    'sonar-',
    'command-',
    'cerebras-',
  ]

  let label = modelId
  for (const prefix of prefixesToStrip) {
    if (label.startsWith(prefix)) {
      label = label.slice(prefix.length)
      break
    }
  }

  // Remove trailing "-latest" or similar suffixes
  label = label.replace(/-latest$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')

  // Title-case each hyphen-separated segment, keep dots and numbers
  label = label
    .split('-')
    .map((seg) => {
      // uppercase segment if it looks like an acronym (all alpha, ≤4 chars)
      if (/^[a-z]{1,4}$/.test(seg)) return seg.toUpperCase()
      // Otherwise capitalise first char
      return seg.charAt(0).toUpperCase() + seg.slice(1)
    })
    .join(' ')

  // Re-apply the prefix word if the stripped label is now ambiguous/very short
  // (keep as-is — callers display it as "Plugin · Label")
  return label
}

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

export async function GET() {
  const settings = readSettings()

  // ── 1. Discover live Ollama models ──────────────────────────────────────────
  const liveOllamaModels = await getOllamaModels()
  const liveOllamaNames = liveOllamaModels.map((m) => m.name)
  const ollamaReachable = liveOllamaNames.length > 0

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
  // Each plugin emits one ModelEntry per model variant it supports, so agents
  // can independently pick e.g. "Kimi · K2" vs "Kimi · Moonshot 128K".
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

      // For providers that support live model listing, fetch dynamically.
      // This ensures new models (GPT-4.5, o4-mini, etc.) appear automatically.
      let liveModels: string[] | null = null
      if (llmMeta.baseUrl && apiKey) {
        try {
          const modelsRes = await fetch(`${llmMeta.baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(4000),
          })
          if (modelsRes.ok) {
            const modelsJson = (await modelsRes.json()) as { data?: Array<{ id: string }> }
            if (modelsJson.data && Array.isArray(modelsJson.data)) {
              // Filter to chat-capable models only (exclude embeddings, tts, whisper, etc.)
              liveModels = modelsJson.data
                .map((m) => m.id)
                .filter(
                  (id) =>
                    !id.includes('embed') &&
                    !id.includes('tts') &&
                    !id.includes('whisper') &&
                    !id.includes('dall-e') &&
                    !id.includes('babbage') &&
                    !id.includes('davinci') &&
                    !id.includes('-instruct') &&
                    !id.includes('ada') &&
                    !id.includes('curie') &&
                    !id.startsWith('ft:'),
                )
                .sort()
            }
          }
        } catch {
          // Live fetch failed — fall back to static list
        }
      }

      // Use live models if fetched, otherwise fall back to plugin field options or defaults.
      const selectField = plugin.fields.find(
        (f) => f.key === (llmMeta.modelField ?? 'model') && f.type === 'select',
      )
      const allVariants: string[] =
        liveModels ??
        (selectField?.options && selectField.options.length > 0
          ? selectField.options
          : llmMeta.defaultModels)

      for (const variantModelId of allVariants) {
        // Composite ID: "plugin-{pluginId}:{variantModelId}"
        const entryId = `plugin-${row.plugin_id}:${variantModelId}`
        const alreadyInSettings = settings.llm.models.some((m) => m.id === entryId)
        if (!alreadyInSettings) {
          // Build a human-readable variant label from the model ID.
          // e.g. "kimi-k2.5" → "K2.5", "moonshot-v1-128k" → "Moonshot 128K"
          const variantLabel = modelIdToLabel(variantModelId)
          result.push({
            id: entryId,
            name: `${plugin.name} · ${variantLabel}`,
            provider: llmMeta.provider,
            modelId: variantModelId,
            available: true,
            enabled: true,
            limitTokensPerDay: 0,
            limitCostPerDay: 0,
          })
        }
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

  // For plugin-backed models: update the plugin credentials if modelId changed.
  // ID format: "plugin-{pluginId}" (legacy) or "plugin-{pluginId}:{variantModelId}"
  if (body.id.startsWith('plugin-') && body.modelId) {
    const afterPrefix = body.id.slice(7) // "{pluginId}" or "{pluginId}:{variantModelId}"
    const pluginId = afterPrefix.includes(':') ? afterPrefix.split(':')[0]! : afterPrefix
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
    // Plugin model not yet in settings — store its overrides (enabled, limits) there.
    // Extract pluginId from composite "plugin-{pluginId}:{variantModelId}" or legacy "plugin-{pluginId}".
    const afterPrefix = body.id.slice(7)
    const pluginId = afterPrefix.includes(':') ? afterPrefix.split(':')[0]! : afterPrefix
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
