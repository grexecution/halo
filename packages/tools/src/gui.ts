import type { Tool, ToolContext } from './index.js'

interface ComputerUseArgs {
  action: 'screenshot' | 'click' | 'type' | 'scroll'
  coordinate?: [number, number] | undefined
  text?: string | undefined
}

interface ComputerUseResult {
  action: string
  screenshot?: string | undefined
  success?: boolean | undefined
}

export const computerUseTool: Tool<ComputerUseArgs, ComputerUseResult> = {
  id: 'computer_use',
  description: 'Control desktop GUI via Anthropic computer-use. Permission-gated.',
  async run(args, ctx: ToolContext) {
    const check = await ctx.middleware.check(
      'computer_use',
      args as unknown as Record<string, unknown>,
      { sessionId: ctx.sessionId, userId: ctx.agentId },
    )
    if (check.decision === 'deny') {
      throw new Error(`Tool computer_use denied: ${check.reason ?? 'permission policy'}`)
    }

    // Real implementation would call Anthropic computer-use API
    // Returning stub result for testing
    return {
      action: args.action,
      success: true,
      screenshot: args.action === 'screenshot' ? 'data:image/png;base64,stub' : undefined,
    }
  },
}
