import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Tool, ToolContext } from './index.js'

interface FsReadArgs {
  path: string
}

interface FsReadResult {
  content: string
}

export const fsReadTool: Tool<FsReadArgs, FsReadResult> = {
  id: 'fs.read',
  description: 'Read a file. Permission-checked.',
  async run(args, ctx: ToolContext) {
    const check = await ctx.middleware.check(
      'fs.read',
      args as unknown as Record<string, unknown>,
      { sessionId: ctx.sessionId, userId: ctx.agentId },
    )
    if (check.decision === 'deny') {
      throw new Error(`Tool fs.read denied: ${check.reason ?? 'permission policy'}`)
    }
    const content = readFileSync(args.path, 'utf-8')
    return { content }
  },
}

interface FsWriteArgs {
  path: string
  content: string
}

interface FsWriteResult {
  ok: boolean
}

export const fsWriteTool: Tool<FsWriteArgs, FsWriteResult> = {
  id: 'fs.write',
  description: 'Write a file. Permission-checked.',
  async run(args, ctx: ToolContext) {
    const check = await ctx.middleware.check(
      'fs.write',
      args as unknown as Record<string, unknown>,
      { sessionId: ctx.sessionId, userId: ctx.agentId },
    )
    if (check.decision === 'deny') {
      throw new Error(`Tool fs.write denied: ${check.reason ?? 'permission policy'}`)
    }
    const dir = dirname(args.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(args.path, args.content, 'utf-8')
    return { ok: true }
  },
}
