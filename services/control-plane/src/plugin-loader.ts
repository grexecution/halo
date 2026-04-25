/**
 * Plugin auto-discovery and loader
 *
 * Walks services/plugins/ at startup. Every subfolder with a valid plugin.json
 * is registered as a plugin. Plugins declare:
 *   - name, description, version
 *   - tools: array of tool definitions the plugin exposes
 *   - auth: optional OAuth or API key config
 *
 * The control-plane makes plugin tools available to the agent.
 * Credentials are stored in the OS keychain via keytar.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginToolDef {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

export interface PluginAuth {
  type: 'api_key' | 'oauth2' | 'none'
  /** env var or keychain key name for the credential */
  credentialKey?: string
  oauthConfig?: {
    authUrl: string
    tokenUrl: string
    scopes: string[]
  }
}

export interface PluginManifest {
  name: string
  description: string
  version: string
  tools: PluginToolDef[]
  auth: PluginAuth
  /** relative path to the handler module (default: handler.ts / handler.js) */
  handler?: string
}

export interface LoadedPlugin extends PluginManifest {
  /** absolute path to the plugin directory */
  dir: string
  /** loaded handler module (if present) */
  module?: Record<string, (...args: unknown[]) => unknown> | undefined
  credentialSet: boolean
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Resolve plugins dir: repo-root/services/plugins
const PLUGINS_DIR = join(__dirname, '..', '..', '..', 'services', 'plugins')

class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map()

  /** Discover and load all plugins. Call once at startup. */
  async init(): Promise<void> {
    if (!existsSync(PLUGINS_DIR)) return

    const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pluginDir = join(PLUGINS_DIR, entry.name)
      const manifestPath = join(pluginDir, 'plugin.json')
      if (!existsSync(manifestPath)) continue

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest

        // Check if credential is set
        let credentialSet = false
        if (manifest.auth.type === 'none') {
          credentialSet = true
        } else if (manifest.auth.credentialKey) {
          credentialSet = Boolean(process.env[manifest.auth.credentialKey])
          if (!credentialSet) {
            // Try keytar (optional dep — graceful fallback if not available)
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { default: keytar } = (await import('keytar' as any)) as {
                default: {
                  getPassword: (service: string, account: string) => Promise<string | null>
                }
              }
              const val = await keytar.getPassword('open-greg', manifest.auth.credentialKey)
              credentialSet = val != null
            } catch {
              // keytar not available
            }
          }
        }

        // Load handler module if present
        const handlerPath = join(pluginDir, manifest.handler ?? 'handler.js')
        let mod: Record<string, (...args: unknown[]) => unknown> | undefined
        if (existsSync(handlerPath)) {
          try {
            mod = (await import(handlerPath)) as Record<string, (...args: unknown[]) => unknown>
          } catch {
            // handler not loadable (e.g. TS not compiled) — still register the plugin manifest
          }
        }

        const loaded: LoadedPlugin = { ...manifest, dir: pluginDir, module: mod, credentialSet }
        this.plugins.set(manifest.name, loaded)
      } catch (err) {
        process.stderr.write(`Plugin load failed (${entry.name}): ${String(err)}\n`)
      }
    }
  }

  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  /** Set a credential for a plugin (stores in env for this process; keytar if available) */
  async setCredential(pluginName: string, value: string): Promise<void> {
    const plugin = this.plugins.get(pluginName)
    if (!plugin?.auth.credentialKey) throw new Error(`Plugin ${pluginName} has no credential key`)

    process.env[plugin.auth.credentialKey] = value
    plugin.credentialSet = true

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { default: keytar } = (await import('keytar' as any)) as {
        default: {
          setPassword: (service: string, account: string, password: string) => Promise<void>
        }
      }
      await keytar.setPassword('open-greg', plugin.auth.credentialKey, value)
    } catch {
      // keytar not available — credential only set in process env for this session
    }
  }

  /** Get all tool definitions across all credentialed plugins */
  getActiveTools(): Array<PluginToolDef & { plugin: string }> {
    const tools: Array<PluginToolDef & { plugin: string }> = []
    for (const plugin of this.plugins.values()) {
      if (!plugin.credentialSet) continue
      for (const tool of plugin.tools) {
        tools.push({ ...tool, plugin: plugin.name })
      }
    }
    return tools
  }
}

export const pluginLoader = new PluginLoader()
