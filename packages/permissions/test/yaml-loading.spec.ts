/**
 * F-040: Permission YAML loading
 * Verifies that permissions.yml is loaded at startup and hot-reloaded on change.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadPermissions, watchPermissions, type PermissionConfig } from '../src/index.js'

describe('F-040: Permission YAML loading', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claw-perms-'))
    mkdirSync(join(tmpDir, '.claw-alt'), { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loads a valid permissions.yml file', async () => {
    const yamlPath = join(tmpDir, '.claw-alt', 'permissions.yml')
    writeFileSync(
      yamlPath,
      `
tools:
  get_time:
    allow: true
  shell_exec:
    allow: false
network:
  url_whitelist_mode: false
filesystem:
  sudo: false
  allowed_paths:
    - /tmp
`,
    )
    const config = await loadPermissions(yamlPath)
    expect(config).toBeDefined()
    expect(config.tools?.['get_time']?.allow).toBe(true)
    expect(config.tools?.['shell_exec']?.allow).toBe(false)
    expect(config.network?.url_whitelist_mode).toBe(false)
    expect(config.filesystem?.sudo).toBe(false)
    expect(config.filesystem?.allowed_paths).toContain('/tmp')
  })

  it('returns default config when file does not exist', async () => {
    const config = await loadPermissions(join(tmpDir, 'nonexistent.yml'))
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('hot-reloads on file change', async () => {
    const yamlPath = join(tmpDir, '.claw-alt', 'permissions.yml')
    writeFileSync(yamlPath, 'tools:\n  get_time:\n    allow: true\n')

    let latestConfig: PermissionConfig | undefined
    const stop = await watchPermissions(yamlPath, (cfg) => {
      latestConfig = cfg
    })

    // Update the file
    await new Promise((r) => setTimeout(r, 50))
    writeFileSync(yamlPath, 'tools:\n  get_time:\n    allow: false\n')

    // Wait for hot-reload
    await new Promise((r) => setTimeout(r, 500))
    stop()

    expect(latestConfig?.tools?.['get_time']?.allow).toBe(false)
  })

  it('validates against schema and rejects invalid config', async () => {
    const yamlPath = join(tmpDir, '.claw-alt', 'permissions.yml')
    writeFileSync(yamlPath, 'tools: "not-an-object"\n')
    await expect(loadPermissions(yamlPath)).rejects.toThrow()
  })
})
