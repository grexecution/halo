/**
 * Mastra tool definitions for open-greg.
 *
 * Each tool wraps an existing primitive (shell, fs, gui, browser, vision)
 * and runs the permission middleware check before execution.
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadPermissions, createMiddleware } from '@open-greg/permissions'
import type { PermissionMiddleware } from '@open-greg/permissions'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { withTimeout } from './timeout.js'
import { executeCodeTool } from './execute-code.js'
import { sendTelegramNotification } from './notifier.js'

// ---------------------------------------------------------------------------
// Permissions middleware — loaded lazily, cached
// ---------------------------------------------------------------------------

const PERMISSIONS_FILE = join(homedir(), '.open-greg', 'permissions.yml')
let _middleware: PermissionMiddleware | null = null

async function getMiddleware(): Promise<PermissionMiddleware> {
  if (_middleware) return _middleware
  const config = await loadPermissions(PERMISSIONS_FILE)
  _middleware = createMiddleware(config)
  return _middleware
}

/** Call this to force a reload after permissions.yml changes. */
export function resetPermissionsCache() {
  _middleware = null
}

// ---------------------------------------------------------------------------
// Shared deny helper
// ---------------------------------------------------------------------------

function denied(reason?: string) {
  return { ok: false, error: `Permission denied: ${reason ?? 'policy'}` }
}

// ---------------------------------------------------------------------------
// get_time
// ---------------------------------------------------------------------------

export const getTimeTool = createTool({
  id: 'get_time',
  description: 'Returns the current date and time in the specified timezone (default UTC).',
  inputSchema: z.object({
    timezone: z.string().optional().describe('IANA timezone string, e.g. Europe/Vienna'),
  }),
  execute: async (inputData) => {
    const tz = inputData.timezone ?? process.env['TZ'] ?? 'UTC'
    return { iso: new Date().toISOString(), timezone: tz }
  },
})

// ---------------------------------------------------------------------------
// shell_exec
// ---------------------------------------------------------------------------

export const shellExecTool = createTool({
  id: 'shell_exec',
  description: 'Execute a shell command on the local machine. Subject to permissions policy.',
  inputSchema: z.object({
    cmd: z.string().describe('Shell command to run'),
    cwd: z.string().optional().describe('Working directory (default: home)'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default 30000)'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check(
      'shell_exec',
      { cmd: inputData.cmd },
      { sessionId: 'agent' },
    )
    if (check.decision === 'deny') return denied(check.reason)

    const result = spawnSync(inputData.cmd, {
      shell: true,
      cwd: inputData.cwd ?? homedir(),
      encoding: 'utf-8',
      timeout: inputData.timeout ?? 30_000,
    })

    return {
      ok: true,
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    }
  },
})

// ---------------------------------------------------------------------------
// fs_read
// ---------------------------------------------------------------------------

export const fsReadTool = createTool({
  id: 'fs_read',
  description: 'Read the contents of a file from the local filesystem.',
  inputSchema: z.object({
    path: z.string().describe('Absolute or relative file path'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check(
      'fs.read',
      { path: inputData.path },
      { sessionId: 'agent' },
    )
    if (check.decision === 'deny') return denied(check.reason)

    const content = readFileSync(inputData.path, 'utf-8')
    return { ok: true, content }
  },
})

// ---------------------------------------------------------------------------
// fs_write
// ---------------------------------------------------------------------------

export const fsWriteTool = createTool({
  id: 'fs_write',
  description: 'Write content to a file on the local filesystem.',
  inputSchema: z.object({
    path: z.string().describe('Absolute or relative file path'),
    content: z.string().describe('Content to write'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check(
      'fs.write',
      { path: inputData.path },
      { sessionId: 'agent' },
    )
    if (check.decision === 'deny') return denied(check.reason)

    const dir = dirname(inputData.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(inputData.path, inputData.content, 'utf-8')
    return { ok: true }
  },
})

// ---------------------------------------------------------------------------
// browser_navigate — calls browser-service over HTTP
// ---------------------------------------------------------------------------

export const browserNavigateTool = createTool({
  id: 'browser_navigate',
  description: 'Navigate to a URL and optionally extract content from the page.',
  inputSchema: z.object({
    url: z.string().describe('URL to navigate to'),
    selector: z.string().optional().describe('CSS selector to extract text from (optional)'),
    screenshot: z.boolean().optional().describe('Capture a screenshot (default false)'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check(
      'browser_navigate',
      { url: inputData.url },
      { sessionId: 'agent' },
    )
    if (check.decision === 'deny') return denied(check.reason)

    const browserUrl = process.env['BROWSER_SERVICE_URL'] ?? 'http://localhost:3002'
    try {
      return await withTimeout(
        async () => {
          const resp = await fetch(`${browserUrl}/navigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: inputData.url,
              selector: inputData.selector,
              screenshot: inputData.screenshot ?? false,
            }),
          })
          if (!resp.ok) return { ok: false, error: `Browser service error: ${resp.status}` }
          const data = (await resp.json()) as Record<string, unknown>
          return { ok: true, ...data }
        },
        60_000,
        'browser_navigate',
      )
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// vision_analyze — calls vision-service over HTTP
// ---------------------------------------------------------------------------

export const visionAnalyzeTool = createTool({
  id: 'vision_analyze',
  description: 'Analyze an image using OCR or visual understanding.',
  inputSchema: z.object({
    imageBase64: z.string().optional().describe('Base64-encoded image data'),
    imagePath: z.string().optional().describe('Path to an image file on disk'),
    prompt: z.string().optional().describe('Optional question or instruction for the vision model'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check('vision_analyze', {}, { sessionId: 'agent' })
    if (check.decision === 'deny') return denied(check.reason)

    const visionUrl = process.env['VISION_SERVICE_URL'] ?? 'http://localhost:3003'
    try {
      return await withTimeout(
        async () => {
          const resp = await fetch(`${visionUrl}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: inputData.imageBase64,
              imagePath: inputData.imagePath,
              prompt: inputData.prompt,
            }),
          })
          if (!resp.ok) return { ok: false, error: `Vision service error: ${resp.status}` }
          const data = (await resp.json()) as Record<string, unknown>
          return { ok: true, ...data }
        },
        60_000,
        'vision_analyze',
      )
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// computer_use — desktop GUI control (Anthropic computer-use)
// ---------------------------------------------------------------------------

export const computerUseTool = createTool({
  id: 'computer_use',
  description: 'Control the desktop GUI: take screenshots, click, type, scroll.',
  inputSchema: z.object({
    action: z.enum(['screenshot', 'click', 'type', 'scroll']).describe('Action to perform'),
    coordinate: z
      .tuple([z.number(), z.number()])
      .optional()
      .describe('Screen coordinates [x, y] for click/scroll'),
    text: z.string().optional().describe('Text to type'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check(
      'computer_use',
      { action: inputData.action },
      { sessionId: 'agent' },
    )
    if (check.decision === 'deny') return denied(check.reason)

    // Real implementation delegates to Anthropic computer-use API via vision-service.
    const visionUrl = process.env['VISION_SERVICE_URL'] ?? 'http://localhost:3003'
    try {
      return await withTimeout(
        async () => {
          const resp = await fetch(`${visionUrl}/computer-use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputData),
          })
          if (!resp.ok) return { ok: false, error: `Vision service error: ${resp.status}` }
          const data = (await resp.json()) as Record<string, unknown>
          return { ok: true, ...data }
        },
        60_000,
        'computer_use',
      )
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// suggest_settings_change — propose a settings change to the user
// The dashboard renders this as a SettingsChangeCard with Apply / Dismiss.
// ---------------------------------------------------------------------------

export const suggestSettingsChangeTool = createTool({
  id: 'suggest_settings_change',
  description:
    'Propose changes to open-greg settings. The user will see a diff card with Apply/Dismiss buttons. ' +
    'Use this when you detect misconfiguration, want to improve performance, or the user asks you to change a setting.',
  inputSchema: z.object({
    section: z.string().optional().describe('Settings section, e.g. "llm", "telegram", "agent"'),
    summary: z.string().describe('One-sentence summary of why this change is recommended'),
    changes: z
      .array(
        z.object({
          key: z.string().describe('Dot-path to the setting, e.g. "llm.model"'),
          oldValue: z.unknown().optional().describe('Current value (leave undefined if unknown)'),
          newValue: z.unknown().describe('Proposed new value'),
          description: z.string().optional().describe('Why this specific change is needed'),
        }),
      )
      .min(1),
  }),
  execute: async (inputData) => {
    // This tool is "display-only" — the dashboard renders it as a SettingsChangeCard.
    // The agent calling it is signalling to the UI that a change is recommended.
    // The actual PATCH happens when the user clicks "Apply" in the dashboard.
    return {
      ok: true,
      proposed: inputData.changes.length,
      message: `Showing ${inputData.changes.length} proposed change(s) to the user.`,
    }
  },
})

// ---------------------------------------------------------------------------
// create_agent — create a new agent configuration
// ---------------------------------------------------------------------------

export const createAgentTool = createTool({
  id: 'create_agent',
  description:
    'Create a new agent with a specific persona, model, and tool permissions. ' +
    'Use this when the user asks to set up a new agent for a specific task.',
  inputSchema: z.object({
    handle: z.string().describe('Unique slug for the agent, e.g. "researcher"'),
    name: z.string().describe('Display name, e.g. "Research Assistant"'),
    systemPrompt: z.string().describe('System prompt / persona for the agent'),
    model: z
      .string()
      .optional()
      .describe('Model ID, e.g. "claude-haiku-4-5-20251001" or "llama3.2"'),
    tools: z
      .array(z.enum(['shell', 'browser', 'filesystem', 'vision', 'code']))
      .optional()
      .describe('Tools to enable for this agent'),
  }),
  execute: async (inputData) => {
    const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000'
    try {
      const resp = await fetch(`${dashboardUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inputData.handle,
          handle: inputData.handle,
          name: inputData.name,
          systemPrompt: inputData.systemPrompt,
          model: inputData.model ?? 'auto',
          tools: inputData.tools ?? [],
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!resp.ok) return { ok: false, error: `Dashboard returned ${resp.status}` }
      const data = (await resp.json()) as Record<string, unknown>
      return { ok: true, agent: data }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// edit_agent — update an existing agent's configuration
// ---------------------------------------------------------------------------

export const editAgentTool = createTool({
  id: 'edit_agent',
  description:
    "Update an existing agent's name, system prompt, model, or tool permissions. " +
    'Use this when the user asks to change how an agent behaves.',
  inputSchema: z.object({
    handle: z.string().describe('Agent handle/slug to update'),
    name: z.string().optional().describe('New display name'),
    systemPrompt: z.string().optional().describe('New system prompt'),
    model: z.string().optional().describe('New model ID'),
    tools: z
      .array(z.enum(['shell', 'browser', 'filesystem', 'vision', 'code']))
      .optional()
      .describe('Updated tool list'),
  }),
  execute: async (inputData) => {
    const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000'
    try {
      const resp = await fetch(`${dashboardUrl}/api/agents/${inputData.handle}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(inputData.name !== undefined && { name: inputData.name }),
          ...(inputData.systemPrompt !== undefined && { systemPrompt: inputData.systemPrompt }),
          ...(inputData.model !== undefined && { model: inputData.model }),
          ...(inputData.tools !== undefined && { tools: inputData.tools }),
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!resp.ok) return { ok: false, error: `Dashboard returned ${resp.status}` }
      const data = (await resp.json()) as Record<string, unknown>
      return { ok: true, agent: data }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// create_skill — write a new skill to disk
// ---------------------------------------------------------------------------

export const createSkillTool = createTool({
  id: 'create_skill',
  description:
    'Create a new skill and save it to disk. Skills teach Halo how to use a specific tool or service. After creation, the skill is immediately available.',
  inputSchema: z.object({
    name: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .describe('Kebab-case skill name, e.g. "github" or "notion-search"'),
    description: z
      .string()
      .describe(
        'One or two sentences: what the skill does AND when to use it. This is what Halo sees in the system prompt.',
      ),
    body: z.string().describe('Full skill body in markdown — workflow steps, rules, examples'),
    requiresEnv: z
      .array(z.string())
      .optional()
      .describe('Environment variable names this skill needs, e.g. ["GITHUB_TOKEN"]'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check('create_skill', inputData, { sessionId: 'agent' })
    if (check.decision === 'deny') return denied(check.reason)

    try {
      const { skillLoader } = await import('./skill-loader.js')
      const skill = skillLoader.createOrUpdate({
        name: inputData.name,
        description: inputData.description,
        body: inputData.body,
        requiresEnv: inputData.requiresEnv ?? [],
      })
      return {
        ok: true,
        name: skill.name,
        path: skill.path,
        message: `Skill "${skill.name}" created. ${
          (inputData.requiresEnv ?? []).length > 0
            ? `It needs these credentials to work: ${(inputData.requiresEnv ?? []).join(', ')}. Use connect_skill to store them.`
            : 'No credentials needed — it is ready to use.'
        }`,
      }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// edit_skill — update an existing skill
// ---------------------------------------------------------------------------

export const editSkillTool = createTool({
  id: 'edit_skill',
  description:
    'Update an existing skill — change its description, body, required credentials, or enabled state.',
  inputSchema: z.object({
    name: z.string().describe('Skill name to edit'),
    description: z.string().optional().describe('New description (replaces existing)'),
    body: z.string().optional().describe('New body (replaces existing)'),
    requiresEnv: z
      .array(z.string())
      .optional()
      .describe('New required env vars list (replaces existing)'),
    enabled: z.boolean().optional().describe('Enable or disable the skill'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check('edit_skill', inputData, { sessionId: 'agent' })
    if (check.decision === 'deny') return denied(check.reason)

    try {
      const { skillLoader } = await import('./skill-loader.js')
      const existing = skillLoader.get(inputData.name)
      if (!existing) return { ok: false, error: `Skill "${inputData.name}" not found` }

      skillLoader.createOrUpdate({
        name: inputData.name,
        description: inputData.description ?? existing.description,
        body: inputData.body ?? existing.body,
        requiresEnv: inputData.requiresEnv ?? existing.requiresEnv,
        enabled: inputData.enabled ?? existing.enabled,
        version: existing.version,
      })
      return { ok: true, message: `Skill "${inputData.name}" updated.` }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// connect_skill — securely store a credential for a skill
// ---------------------------------------------------------------------------

export const connectSkillTool = createTool({
  id: 'connect_skill',
  description:
    'Securely store a credential (API key, token, etc.) that a skill needs. The value is encrypted and stored via keytar. Use this after the user provides an API key.',
  inputSchema: z.object({
    skillName: z.string().describe('The skill this credential belongs to'),
    envKey: z.string().describe('The environment variable name, e.g. "GITHUB_TOKEN"'),
    value: z.string().describe('The credential value provided by the user'),
  }),
  execute: async (inputData) => {
    const middleware = await getMiddleware()
    const check = await middleware.check('connect_skill', inputData, { sessionId: 'agent' })
    if (check.decision === 'deny') return denied(check.reason)

    try {
      const { skillLoader } = await import('./skill-loader.js')
      await skillLoader.storeCredential(inputData.envKey, inputData.value)

      const stillMissing = await skillLoader.missingCredentials(inputData.skillName)
      if (stillMissing.length > 0) {
        return {
          ok: true,
          message: `${inputData.envKey} saved. The "${inputData.skillName}" skill still needs: ${stillMissing.join(', ')}.`,
        }
      }
      return {
        ok: true,
        message: `${inputData.envKey} saved. The "${inputData.skillName}" skill is now fully connected and ready to use.`,
      }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// notify_user — proactive Telegram send
// ---------------------------------------------------------------------------

export const notifyUserTool = createTool({
  id: 'notify_user',
  description:
    'Send a proactive notification to the user via Telegram. Use this when a background task completes, something important happens, or you want to check in. Do not use for routine replies — only for unsolicited outbound messages.',
  inputSchema: z.object({
    message: z.string().describe('The message to send to the user'),
    priority: z
      .enum(['normal', 'urgent'])
      .optional()
      .default('normal')
      .describe('urgent prepends 🚨 to the message'),
  }),
  execute: async (inputData) => {
    try {
      const text = inputData.priority === 'urgent' ? `🚨 ${inputData.message}` : inputData.message
      await sendTelegramNotification(text)
      return { ok: true, sent: text }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  },
})

// ---------------------------------------------------------------------------
// Export all tools keyed by ID (Mastra expects a record)
// ---------------------------------------------------------------------------

export const allMastraTools = {
  get_time: getTimeTool,
  shell_exec: shellExecTool,
  fs_read: fsReadTool,
  fs_write: fsWriteTool,
  browser_navigate: browserNavigateTool,
  vision_analyze: visionAnalyzeTool,
  computer_use: computerUseTool,
  execute_code: executeCodeTool,
  suggest_settings_change: suggestSettingsChangeTool,
  create_agent: createAgentTool,
  edit_agent: editAgentTool,
  create_skill: createSkillTool,
  edit_skill: editSkillTool,
  connect_skill: connectSkillTool,
  notify_user: notifyUserTool,
}
