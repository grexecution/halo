import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

describe('F-002: CLI wizard', () => {
  it('wizard.ts exists', async () => {
    const { existsSync: ef } = await import('node:fs')
    expect(ef(resolve(import.meta.dirname, '../src/wizard.ts'))).toBe(true)
  })

  it('exports runWizard and loadConfig', async () => {
    const mod = await import('../src/wizard.js')
    expect(typeof mod.runWizard).toBe('function')
    expect(typeof mod.loadConfig).toBe('function')
  })

  describe('loadConfig', () => {
    it('returns defaults when config file does not exist', async () => {
      const { loadConfig } = await import('../src/wizard.js')
      const cfg = await loadConfig(resolve(tmpdir(), `nonexistent-${Date.now()}/config.yml`))
      expect(cfg.llm_provider).toBeDefined()
      expect(cfg.dashboard_port).toBe(3000)
    })
  })

  describe('wizard idempotency (F-002 acceptance)', () => {
    const configDir = resolve(tmpdir(), `claw-wizard-test-${Date.now()}`)
    const configPath = resolve(configDir, 'config.yml')

    afterEach(() => {
      if (existsSync(configDir)) rmSync(configDir, { recursive: true })
    })

    it('writes config on first run', async () => {
      const { runWizard } = await import('../src/wizard.js')
      await runWizard({
        nonInteractive: true,
        configPath,
        llmProvider: 'anthropic',
        dashboardPort: 3000,
        controlPlanePort: 3001,
      })
      expect(existsSync(configPath)).toBe(true)
    })

    it('re-run updates config without destroying existing data', async () => {
      const { runWizard, loadConfig } = await import('../src/wizard.js')
      await runWizard({
        nonInteractive: true,
        configPath,
        llmProvider: 'anthropic',
        dashboardPort: 3000,
        controlPlanePort: 3001,
      })
      // Second run with different port
      await runWizard({
        nonInteractive: true,
        configPath,
        llmProvider: 'anthropic',
        dashboardPort: 4000,
        controlPlanePort: 3001,
      })
      const cfg = await loadConfig(configPath)
      expect(cfg.dashboard_port).toBe(4000)
      // Original llm_provider still present
      expect(cfg.llm_provider).toBe('anthropic')
    })
  })
})
