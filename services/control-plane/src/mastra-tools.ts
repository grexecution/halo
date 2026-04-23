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
}
