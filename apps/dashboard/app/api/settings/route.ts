import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readSettings, writeSettings } from './store'
import type { Settings } from './store'
import { resetMemory } from '../../lib/memory'

export async function GET() {
  try {
    return NextResponse.json(readSettings())
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Settings
    writeSettings(body)
    // Invalidate the Memory singleton so it rebuilds with the new model config
    resetMemory()
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
