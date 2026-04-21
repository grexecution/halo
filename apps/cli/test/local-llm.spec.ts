/**
 * F-003: Local LLM one-click install
 */
import { describe, it, expect } from 'vitest'
import { LocalLLMInstaller } from '../src/local-llm.js'

describe('F-003: Local LLM one-click install', () => {
  it('lists available tiers', () => {
    const installer = new LocalLLMInstaller({ dryRun: true })
    const tiers = installer.getTiers()
    expect(tiers).toHaveLength(3)
    const names = tiers.map((t) => t.name)
    expect(names).toContain('weak')
    expect(names).toContain('mid')
    expect(names).toContain('strong')
  })

  it('installs the weak tier model', async () => {
    const installer = new LocalLLMInstaller({ dryRun: true })
    const result = await installer.install('weak')
    expect(result.success).toBe(true)
    expect(result.model).toMatch(/3[bB]|3\.8[bB]/)
  })

  it('installs the mid tier model', async () => {
    const installer = new LocalLLMInstaller({ dryRun: true })
    const result = await installer.install('mid')
    expect(result.success).toBe(true)
    expect(result.model).toMatch(/14[bB]/)
  })

  it('reports progress during install', async () => {
    const installer = new LocalLLMInstaller({ dryRun: true })
    const progress: number[] = []
    await installer.install('weak', (p) => progress.push(p))
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[progress.length - 1]).toBe(100)
  })
})
