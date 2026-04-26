export const dynamic = 'force-dynamic'
/**
 * GET /api/connectors/cli-status
 *
 * Checks which CLI tools are installed and authenticated on the server.
 * Returns { [bin]: { installed: boolean; authed: boolean; output: string } }
 */
import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

interface CliStatus {
  installed: boolean
  authed: boolean
  detail: string // short human-readable status
}

async function checkCli(bin: string, authCmd: string[]): Promise<CliStatus> {
  // First check if binary exists
  try {
    await exec('which', [bin], { timeout: 5000 })
  } catch {
    return { installed: false, authed: false, detail: 'Not installed' }
  }

  // Check auth
  try {
    const { stdout, stderr } = await exec(bin, authCmd, { timeout: 10000 })
    const out = (stdout + stderr).trim()
    return { installed: true, authed: true, detail: out.split('\n')[0] ?? 'Authenticated' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { installed: true, authed: false, detail: msg.split('\n')[0] ?? 'Not authenticated' }
  }
}

const CLI_CHECKS: Record<string, { bin: string; authArgs: string[] }> = {
  gog: { bin: 'gog', authArgs: ['auth', 'list'] },
  gh: { bin: 'gh', authArgs: ['auth', 'status'] },
  slack: { bin: 'slack', authArgs: ['auth', 'list'] },
}

export async function GET() {
  const results = await Promise.all(
    Object.entries(CLI_CHECKS).map(async ([key, { bin, authArgs }]) => {
      const status = await checkCli(bin, authArgs)
      return [key, status] as const
    }),
  )
  return NextResponse.json(Object.fromEntries(results))
}
