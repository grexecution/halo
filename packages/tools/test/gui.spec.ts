/**
 * F-052: Desktop GUI control (computer-use)
 *
 * Verifies that GUI actions are dispatched and results are structured
 * correctly. Uses dryRun mode to avoid requiring a running vision service.
 */
import { describe, it, expect } from 'vitest'
import { performGuiAction } from '../src/gui.js'

describe('F-052: Desktop GUI control (computer-use)', () => {
  it('returns a screenshot in dryRun mode', async () => {
    const result = await performGuiAction({ action: 'screenshot', dryRun: true })
    expect(result.ok).toBe(true)
    expect(result.screenshotBase64).toBeDefined()
    expect(typeof result.screenshotBase64).toBe('string')
  })

  it('performs a click in dryRun mode', async () => {
    const result = await performGuiAction({
      action: 'click',
      coordinate: [100, 200],
      dryRun: true,
    })
    expect(result.ok).toBe(true)
  })

  it('performs a type action in dryRun mode', async () => {
    const result = await performGuiAction({
      action: 'type',
      text: 'hello world',
      dryRun: true,
    })
    expect(result.ok).toBe(true)
  })

  it('performs a scroll in dryRun mode', async () => {
    const result = await performGuiAction({
      action: 'scroll',
      coordinate: [500, 300],
      dryRun: true,
    })
    expect(result.ok).toBe(true)
  })

  it('performs a key press in dryRun mode', async () => {
    const result = await performGuiAction({
      action: 'key',
      key: 'Return',
      dryRun: true,
    })
    expect(result.ok).toBe(true)
  })

  it('returns error when vision service is unreachable', async () => {
    const result = await performGuiAction({
      action: 'screenshot',
      dryRun: false,
      visionServiceUrl: 'http://127.0.0.1:19999', // port nobody is listening on
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('non-screenshot actions return ok without screenshotBase64', async () => {
    const result = await performGuiAction({ action: 'click', coordinate: [0, 0], dryRun: true })
    expect(result.ok).toBe(true)
    expect(result.screenshotBase64).toBeUndefined()
  })
})
