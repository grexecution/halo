import { spawnSync } from 'node:child_process'
import type { Tool, ToolContext } from './index.js'

interface ShellExecArgs {
  cmd: string
  cwd?: string | undefined
  timeout?: number | undefined
}

interface ShellExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

export const shellExecTool: Tool<ShellExecArgs, ShellExecResult> = {
  id: 'shell_exec',
  description: 'Execute a shell command. Permission-checked.',
  async run(args, ctx: ToolContext) {
    const check = await ctx.middleware.check(
      'shell_exec',
      args as unknown as Record<string, unknown>,
      { sessionId: ctx.sessionId, userId: ctx.agentId },
    )
    if (check.decision === 'deny') {
      throw new Error(`Tool shell_exec denied: ${check.reason ?? 'permission policy'}`)
    }

    const result = spawnSync(args.cmd, {
      shell: true,
      cwd: args.cwd,
      encoding: 'utf-8',
      timeout: args.timeout ?? 30_000,
    })

    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    }
  },
}
