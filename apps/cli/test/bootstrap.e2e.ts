import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const CLI_ENTRY = resolve(REPO_ROOT, 'apps/cli/src/index.ts')

describe('F-001: npx bootstrap', () => {
  it('apps/cli/src/index.ts exists', () => {
    expect(existsSync(CLI_ENTRY)).toBe(true)
  })

  it('CLI accepts --help without error', () => {
    const result = spawnSync('node', ['--import', 'tsx/esm', CLI_ENTRY, '--help'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 15_000,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    })
    expect(result.status).toBe(0)
  })

  it('CLI accepts init command in non-interactive mode', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx/esm', CLI_ENTRY, 'init', '--non-interactive'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 30_000,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          CLAW_NON_INTERACTIVE: '1',
          CLAW_SECRET_PASSPHRASE: 'test-passphrase-32-chars-long-xx',
          CLAW_CONFIG_DIR: resolve(tmpdir(), `open-greg-test-${Date.now()}`),
        },
      },
    )
    expect(result.status).toBe(0)
  })

  it('CLI generates a CLAW_SECRET_PASSPHRASE when none is set', () => {
    const result = spawnSync(
      'node',
      ['--import', 'tsx/esm', CLI_ENTRY, 'init', '--non-interactive', '--print-passphrase'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        timeout: 15_000,
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          CLAW_NON_INTERACTIVE: '1',
          CLAW_CONFIG_DIR: resolve(tmpdir(), `open-greg-test-passgen-${Date.now()}`),
        },
      },
    )
    expect(result.status).toBe(0)
    // Output should contain a hex passphrase (64 hex chars)
    expect(result.stdout).toMatch(/[0-9a-f]{64}/)
  })
})
