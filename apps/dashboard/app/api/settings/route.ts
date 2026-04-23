import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readSettings, writeSettings } from './store'
import type { Settings } from './store'
import { resetMemory } from '../../lib/memory'
import { CONTROL_PLANE_URL } from '../../lib/env'

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
    // Also reset the control-plane agent (best-effort, fire-and-forget)
    void fetch(`${CONTROL_PLANE_URL}/api/reset`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {
      /* ignore if control-plane not running */
    })
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

/** PATCH — merge partial updates (used by SettingsChangeCard "Apply" button). */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { section?: string; updates: Record<string, unknown> }
    const current = readSettings()

    // Apply dot-path updates, e.g. { "llm.model": "claude-haiku-4-5" }
    const updated = { ...current } as Record<string, unknown>
    for (const [key, value] of Object.entries(body.updates ?? {})) {
      const parts = key.split('.')
      if (parts.length === 1) {
        updated[key] = value
      } else {
        // Nested key — shallow merge into sub-object
        const top = parts[0] as string
        const sub = parts.slice(1).join('.')
        const existing = (updated[top] ?? {}) as Record<string, unknown>
        updated[top] = { ...existing, [sub]: value }
      }
    }

    writeSettings(updated as unknown as Settings)
    resetMemory()
    void fetch(`${CONTROL_PLANE_URL}/api/reset`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {
      /* ignore */
    })

    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to patch settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}
