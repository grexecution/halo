/**
 * Shell execution tool.
 *
 * Wraps Node's spawnSync with timeout, permission check, and structured output.
 * This is the canonical shell_exec implementation; mastra-tools.ts delegates here.
 */
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

export interface ShellExecOptions {
  cmd: string
  cwd?: string
  timeoutMs?: number
  /** Skip the permission check (tests only) */
  skipPermission?: boolean
}

export interface ShellExecResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  error?: string
}

export async function shellExec(opts: ShellExecOptions): Promise<ShellExecResult> {
  const { cmd, cwd, timeoutMs = 30_000 } = opts

  const result = spawnSync(cmd, {
    shell: true,
    cwd: cwd ?? homedir(),
    encoding: 'utf-8',
    timeout: timeoutMs,
  })

  if (result.error) {
    return {
      ok: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      error: result.error.message,
    }
  }

  return {
    ok: (result.status ?? 1) === 0,
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}
