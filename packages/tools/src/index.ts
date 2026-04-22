import type { PermissionMiddleware } from '@open-greg/permissions'

export interface Tool<TArgs = Record<string, unknown>, TResult = unknown> {
  id: string
  description: string
  run(args: TArgs, ctx: ToolContext): Promise<TResult>
}

export interface ToolContext {
  sessionId: string
  agentId: string
  middleware: PermissionMiddleware
}

export interface GetTimeResult {
  iso: string
  timezone: string
}

export const getTimeTool: Tool<{ timezone?: string | undefined }, GetTimeResult> = {
  id: 'get_time',
  description: 'Returns the current date and time in the specified timezone (default UTC).',
  async run(args, _ctx) {
    const tz = args.timezone ?? 'UTC'
    return {
      iso: new Date().toISOString(),
      timezone: tz,
    }
  },
}

export const allTools: Tool[] = [getTimeTool as unknown as Tool]
