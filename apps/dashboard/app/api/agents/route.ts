export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listAgents, upsertAgent } from './store'
import type { Agent } from './store'
import { readSettings } from '../settings/store'
import { getDb } from '../../lib/db'
import { ALL_PLUGINS } from '@open-greg/connectors/plugins'

// Build a modelId → human-readable name lookup from settings + connected plugins.
function buildModelNameMap(): Map<string, string> {
  const map = new Map<string, string>()

  // 1. Settings-configured models
  try {
    const settings = readSettings()
    for (const m of settings.llm.models) {
      map.set(m.id, m.name)
    }
  } catch {
    // non-fatal
  }

  // 2. Plugin-backed model variants (composite ids "plugin-{pluginId}:{variantModelId}")
  try {
    const db = getDb()
    const rows = db.prepare('SELECT plugin_id, fields FROM plugin_credentials').all() as Array<{
      plugin_id: string
      fields: string
    }>
    for (const row of rows) {
      const plugin = ALL_PLUGINS.find((p) => p.id === row.plugin_id)
      if (!plugin?.llmMeta) continue
      let credentials: Record<string, string> = {}
      try {
        credentials = JSON.parse(row.fields) as Record<string, string>
      } catch {
        continue
      }
      const apiKey = credentials[plugin.llmMeta.apiKeyField ?? 'api_key'] ?? ''
      if (!apiKey) continue

      const selectField = plugin.fields.find(
        (f) => f.key === (plugin.llmMeta!.modelField ?? 'model') && f.type === 'select',
      )
      const allVariants: string[] =
        selectField?.options && selectField.options.length > 0
          ? selectField.options
          : plugin.llmMeta.defaultModels

      for (const variantModelId of allVariants) {
        const entryId = `plugin-${row.plugin_id}:${variantModelId}`
        if (!map.has(entryId)) {
          const variantLabel = modelIdToLabel(variantModelId)
          map.set(entryId, `${plugin.name} · ${variantLabel}`)
        }
      }
    }
  } catch {
    // DB unavailable — skip
  }

  return map
}

// Derive a human-readable label from a raw model ID (mirrors logic in models/route.ts).
function modelIdToLabel(modelId: string): string {
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
  label = label.replace(/-latest$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '')
  label = label
    .split('-')
    .map((seg) => {
      if (/^[a-z]{1,4}$/.test(seg)) return seg.toUpperCase()
      return seg.charAt(0).toUpperCase() + seg.slice(1)
    })
    .join(' ')
  return label
}

export function GET() {
  const agents = listAgents()
  const nameMap = buildModelNameMap()

  const agentsWithModelName = agents.map((a) => ({
    ...a,
    modelName: nameMap.get(a.model) ?? a.model,
  }))

  return NextResponse.json({ agents: agentsWithModelName })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Agent
  const agent = upsertAgent(body)
  return NextResponse.json({ agent })
}
