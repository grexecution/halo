/**
 * Desktop GUI control tool (computer-use).
 *
 * Routes actions through the vision-service HTTP API which delegates to
 * either Anthropic computer-use (primary) or pyautogui (local-LLM fallback).
 *
 * In dryRun mode (no VISION_SERVICE_URL or dryRun: true) the functions
 * return canned responses so tests can run without a running vision service.
 */

export type GuiAction = 'screenshot' | 'click' | 'type' | 'scroll' | 'key'

export interface GuiActionOptions {
  action: GuiAction
  coordinate?: [number, number]
  text?: string
  key?: string
  dryRun?: boolean
  visionServiceUrl?: string
}

export interface GuiActionResult {
  ok: boolean
  screenshotBase64?: string
  error?: string
}

export async function performGuiAction(opts: GuiActionOptions): Promise<GuiActionResult> {
  if (opts.dryRun) {
    return {
      ok: true,
      ...(opts.action === 'screenshot' ? { screenshotBase64: 'base64encodedpng==' } : {}),
    }
  }

  const url = opts.visionServiceUrl ?? process.env['VISION_SERVICE_URL'] ?? 'http://localhost:3003'

  try {
    const resp = await fetch(`${url}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: opts.action,
        coordinate: opts.coordinate,
        text: opts.text,
        key: opts.key,
      }),
    })

    if (!resp.ok) {
      return { ok: false, error: `Vision service error: ${resp.status}` }
    }

    const data = (await resp.json()) as Record<string, unknown>
    return { ok: true, ...data } as GuiActionResult
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
