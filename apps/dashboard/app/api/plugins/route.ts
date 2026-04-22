import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const CREDS_FILE = resolve(homedir(), '.claw-alt', 'plugin-credentials.json')

interface PluginCredentials {
  pluginId: string
  fields: Record<string, string>
  connectedAt: string
}

function readAllCredentials(): Record<string, PluginCredentials> {
  try {
    if (!existsSync(CREDS_FILE)) return {}
    return JSON.parse(readFileSync(CREDS_FILE, 'utf-8')) as Record<string, PluginCredentials>
  } catch {
    return {}
  }
}

export async function GET() {
  const all = readAllCredentials()
  // Return only plugin IDs that are connected (no credential values exposed)
  const connected = Object.keys(all)
  return NextResponse.json({ connected })
}

export async function DELETE() {
  try {
    writeFileSync(CREDS_FILE, JSON.stringify({}, null, 2))
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true })
}
