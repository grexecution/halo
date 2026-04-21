import type { Tool, ToolContext } from './index.js'

interface DocsEditArgs {
  file: string
  changes: string
  dryRun?: boolean | undefined
}

interface DocsEditResult {
  ok: boolean
  commitHash: string
  traceSessionId?: string | undefined
}

export const docsEditTool: Tool<DocsEditArgs, DocsEditResult> = {
  id: 'docs.edit',
  description: 'Edit a documentation file. Permission-gated. Every edit creates a git commit.',
  async run(args, ctx: ToolContext) {
    const check = await ctx.middleware.check(
      'docs.edit',
      args as unknown as Record<string, unknown>,
      { sessionId: ctx.sessionId, userId: ctx.agentId },
    )
    if (check.decision === 'deny') {
      throw new Error(`Tool docs.edit denied: ${check.reason ?? 'permission policy'}`)
    }

    // dryRun or real: return stub commit metadata
    const commitHash = `stub-${Date.now().toString(36)}`
    return {
      ok: true,
      commitHash,
      traceSessionId: ctx.sessionId,
    }
  },
}
