/**
 * Read plugin credentials from the dashboard's SQLite database.
 *
 * The dashboard DB lives at ${GREG_DATA_DIR}/app.db (or ~/.open-greg/app.db
 * in local dev). Both the dashboard and control-plane containers mount the same
 * volume at /data, so this path resolves identically in both processes.
 *
 * We open the DB read-only and close it immediately to avoid WAL conflicts with
 * the dashboard writer.
 */
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'

function dbPath(): string {
  // Docker volume mounts at /data; fall back to GREG_DATA_DIR or ~/.open-greg for local dev.
  const dir =
    process.env['GREG_DATA_DIR'] ?? (existsSync('/data') ? '/data' : join(homedir(), '.open-greg'))
  return join(dir, 'app.db')
}

/** Raw credential fields stored for a plugin. */
export interface PluginCredentials {
  fields: Record<string, string>
}

/**
 * Fetch stored credentials for a plugin by its plugin_id.
 * Returns null if the DB does not exist or no credentials are stored.
 */
export function getPluginCredential(pluginId: string): PluginCredentials | null {
  const path = dbPath()
  if (!existsSync(path)) return null

  let db: Database.Database | null = null
  try {
    db = new Database(path, { readonly: true })
    const row = db
      .prepare('SELECT fields FROM plugin_credentials WHERE plugin_id = ?')
      .get(pluginId) as { fields: string } | undefined
    if (!row) return null
    const fields = JSON.parse(row.fields) as Record<string, string>
    return { fields }
  } catch {
    return null
  } finally {
    db?.close()
  }
}

/**
 * Information needed to build an AI SDK provider for a plugin-backed LLM.
 */
export interface PluginLlmInfo {
  baseUrl: string
  apiKey: string
  modelId: string
}

/**
 * Parse a composite plugin model ID of the form `plugin-{pluginId}:{variantModelId}`.
 *
 * Returns the parsed pluginId and variantModelId, or null if the string does
 * not match the expected prefix format.
 */
export function parsePluginModelId(
  compositeId: string,
): { pluginId: string; variantModelId: string } | null {
  if (!compositeId.startsWith('plugin-')) return null
  const rest = compositeId.slice('plugin-'.length) // e.g. "kimi:kimi-k2.5"
  const colonIdx = rest.indexOf(':')
  if (colonIdx === -1) return null
  return {
    pluginId: rest.slice(0, colonIdx),
    variantModelId: rest.slice(colonIdx + 1),
  }
}

/**
 * Minimal LLM plugin catalog — inlined to avoid cross-package import issues.
 * Mirrors the llmMeta fields from packages/connectors/src/plugins.ts.
 * Keep in sync when adding new LLM providers to the connectors package.
 */
interface LlmPlugin {
  id: string
  baseUrl: string
  apiKeyField: string
}

const LLM_PLUGINS: LlmPlugin[] = [
  { id: 'openai', baseUrl: 'https://api.openai.com/v1', apiKeyField: 'api_key' },
  { id: 'kimi', baseUrl: 'https://api.moonshot.cn/v1', apiKeyField: 'api_key' },
  { id: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', apiKeyField: 'api_key' },
  { id: 'xai_grok', baseUrl: 'https://api.x.ai/v1', apiKeyField: 'api_key' },
  { id: 'mistral', baseUrl: 'https://api.mistral.ai/v1', apiKeyField: 'api_key' },
  { id: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKeyField: 'api_key' },
]

/**
 * Given a composite model ID (`plugin-kimi:kimi-k2.5`), resolve the LLM
 * connection info from the plugin catalog + stored credentials.
 *
 * Returns null if:
 *  - The ID is not a plugin model ID
 *  - The plugin is not in the catalog
 *  - No credentials are stored
 *  - The API key field is empty
 */
export function resolvePluginLlm(compositeId: string): PluginLlmInfo | null {
  const parsed = parsePluginModelId(compositeId)
  if (!parsed) return null

  const { pluginId, variantModelId } = parsed

  const plugin = LLM_PLUGINS.find((p) => p.id === pluginId)
  if (!plugin) return null

  const creds = getPluginCredential(pluginId)
  if (!creds) return null

  const apiKey = creds.fields[plugin.apiKeyField] ?? ''
  if (!apiKey) return null

  return {
    baseUrl: plugin.baseUrl,
    apiKey,
    modelId: variantModelId,
  }
}
