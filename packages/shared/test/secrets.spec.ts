import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const SERVICE = 'claw-alt-test'
const ACCOUNT = 'test-account'
const TEST_PASSPHRASE = 'test-passphrase-32-chars-long-xx'
const TEST_SECRET = 'super-secret-value-for-testing'

describe('F-135: Secrets — keychain with headless fallback', () => {
  it('packages/shared/src/secrets.ts exists', async () => {
    const { existsSync: ef } = await import('node:fs')
    expect(ef(resolve(import.meta.dirname, '../src/secrets.ts'))).toBe(true)
  })

  it('exports setSecret, getSecret, deleteSecret', async () => {
    const mod = await import('../src/secrets.js')
    expect(typeof mod.setSecret).toBe('function')
    expect(typeof mod.getSecret).toBe('function')
    expect(typeof mod.deleteSecret).toBe('function')
  })

  describe('AES-GCM fallback path (CLAW_SECRET_PASSPHRASE set)', () => {
    const fallbackFile = resolve(tmpdir(), `claw-alt-secrets-test-${Date.now()}.enc`)

    beforeEach(() => {
      process.env['CLAW_SECRET_PASSPHRASE'] = TEST_PASSPHRASE
      process.env['CLAW_SECRETS_FILE'] = fallbackFile
    })

    afterEach(() => {
      delete process.env['CLAW_SECRET_PASSPHRASE']
      delete process.env['CLAW_SECRETS_FILE']
      if (existsSync(fallbackFile)) unlinkSync(fallbackFile)
    })

    it('stores and retrieves a secret via AES-GCM fallback', async () => {
      const { setSecret, getSecret } = await import('../src/secrets.js')
      await setSecret(SERVICE, ACCOUNT, TEST_SECRET)
      const retrieved = await getSecret(SERVICE, ACCOUNT)
      expect(retrieved).toBe(TEST_SECRET)
    })

    it('returns null for a non-existent secret', async () => {
      const { getSecret } = await import('../src/secrets.js')
      const result = await getSecret(SERVICE, 'nonexistent-account')
      expect(result).toBeNull()
    })

    it('overwrites an existing secret', async () => {
      const { setSecret, getSecret } = await import('../src/secrets.js')
      await setSecret(SERVICE, ACCOUNT, 'first-value')
      await setSecret(SERVICE, ACCOUNT, 'second-value')
      const result = await getSecret(SERVICE, ACCOUNT)
      expect(result).toBe('second-value')
    })

    it('deleteSecret removes the secret', async () => {
      const { setSecret, getSecret, deleteSecret } = await import('../src/secrets.js')
      await setSecret(SERVICE, ACCOUNT, TEST_SECRET)
      const deleted = await deleteSecret(SERVICE, ACCOUNT)
      expect(deleted).toBe(true)
      const after = await getSecret(SERVICE, ACCOUNT)
      expect(after).toBeNull()
    })

    it('fallback file is created on first write', async () => {
      const { setSecret } = await import('../src/secrets.js')
      await setSecret(SERVICE, ACCOUNT, TEST_SECRET)
      expect(existsSync(fallbackFile)).toBe(true)
    })

    it('fails fast if CLAW_SECRET_PASSPHRASE is missing on headless path', async () => {
      delete process.env['CLAW_SECRET_PASSPHRASE']
      const { setSecret } = await import('../src/secrets.js')
      await expect(setSecret(SERVICE, ACCOUNT, TEST_SECRET)).rejects.toThrow(
        /CLAW_SECRET_PASSPHRASE/,
      )
    })
  })
})
