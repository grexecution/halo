import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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

function writeAllCredentials(data: Record<string, PluginCredentials>): void {
  const dir = resolve(homedir(), '.claw-alt')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const all = readAllCredentials()
  const entry = all[id]
  if (!entry) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, connectedAt: entry.connectedAt })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { fields?: Record<string, string> }
  if (!body.fields || typeof body.fields !== 'object') {
    return NextResponse.json({ error: 'fields required' }, { status: 400 })
  }
  const all = readAllCredentials()
  all[id] = { pluginId: id, fields: body.fields, connectedAt: new Date().toISOString() }
  writeAllCredentials(all)
  return NextResponse.json({ ok: true, connectedAt: all[id]!.connectedAt })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const all = readAllCredentials()
  delete all[id]
  writeAllCredentials(all)
  return NextResponse.json({ ok: true })
}
