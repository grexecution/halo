import { readFileSync, existsSync, watchFile, unwatchFile } from 'node:fs'
import { load as yamlLoad } from 'js-yaml'
import { z } from 'zod'

const ToolPolicySchema = z
  .object({
    allow: z.boolean().optional(),
  })
  .strict()

export const PermissionConfigSchema = z.object({
  tools: z.record(z.string(), ToolPolicySchema).optional(),
  network: z
    .object({
      url_whitelist_mode: z.boolean().optional(),
      allowed_urls: z.array(z.string()).optional(),
    })
    .optional(),
  filesystem: z
    .object({
      sudo: z.boolean().optional(),
      allowed_paths: z.array(z.string()).optional(),
    })
    .optional(),
})

export type PermissionConfig = z.infer<typeof PermissionConfigSchema>

const DEFAULT_CONFIG: PermissionConfig = {
  tools: {},
  network: { url_whitelist_mode: false },
  filesystem: { sudo: false, allowed_paths: [] },
}

export async function loadPermissions(yamlPath: string): Promise<PermissionConfig> {
  if (!existsSync(yamlPath)) return { ...DEFAULT_CONFIG }
  const raw = readFileSync(yamlPath, 'utf-8')
  const parsed = yamlLoad(raw)
  return PermissionConfigSchema.parse(parsed)
}

export function watchPermissions(
  yamlPath: string,
  onChange: (config: PermissionConfig) => void,
): Promise<() => void> {
  return new Promise((resolve) => {
    const listener = async () => {
      try {
        const cfg = await loadPermissions(yamlPath)
        onChange(cfg)
      } catch {
        // ignore parse errors during hot-reload
      }
    }
    watchFile(yamlPath, { interval: 100 }, listener)
    const stop = () => unwatchFile(yamlPath, listener)
    resolve(stop)
  })
}

export interface CheckResult {
  decision: 'allow' | 'deny'
  reason?: string | undefined
}

export interface PermissionContext {
  userId?: string | undefined
  sessionId?: string | undefined
}

export interface PermissionMiddleware {
  check(toolId: string, args: Record<string, unknown>, ctx: PermissionContext): Promise<CheckResult>
}

export function createMiddleware(config: PermissionConfig): PermissionMiddleware {
  return {
    async check(toolId: string): Promise<CheckResult> {
      const tools = config.tools ?? {}

      // Check wildcard deny first
      const wildcard = tools['*']
      if (wildcard?.allow === false) {
        return { decision: 'deny', reason: `All tools denied by wildcard policy` }
      }

      // Check specific tool policy
      const policy = tools[toolId]
      if (policy?.allow === false) {
        return { decision: 'deny', reason: `Tool '${toolId}' is not permitted` }
      }

      return { decision: 'allow' }
    },
  }
}
