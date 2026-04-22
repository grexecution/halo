import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import type * as Keytar from 'keytar'

const DEFAULT_SECRETS_FILE = resolve(homedir(), '.open-greg/secrets.enc')
const ALGORITHM = 'aes-256-gcm'
const SALT = 'open-greg-secrets-v1'

type SecretsStore = Record<string, Record<string, string>>

function getPassphrase(): string {
  const pp = process.env['CLAW_SECRET_PASSPHRASE']
  if (!pp) {
    throw new Error(
      'CLAW_SECRET_PASSPHRASE env var is required for headless secrets storage. ' +
        'Generate one with: openssl rand -hex 32',
    )
  }
  return pp
}

function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, SALT, 32) as Buffer
}

function encryptStore(store: SecretsStore, passphrase: string): Buffer {
  const key = deriveKey(passphrase)
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(store), 'utf-8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Layout: [iv(12)] [authTag(16)] [ciphertext]
  return Buffer.concat([iv, authTag, encrypted])
}

function decryptStore(data: Buffer, passphrase: string): SecretsStore {
  const key = deriveKey(passphrase)
  const iv = data.subarray(0, 12)
  const authTag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf-8')) as SecretsStore
}

function getSecretsFile(): string {
  return process.env['CLAW_SECRETS_FILE'] ?? DEFAULT_SECRETS_FILE
}

function loadStore(passphrase: string): SecretsStore {
  const file = getSecretsFile()
  if (!existsSync(file)) return {}
  const data = readFileSync(file)
  return decryptStore(data, passphrase)
}

function saveStore(store: SecretsStore, passphrase: string): void {
  const file = getSecretsFile()
  const dir = dirname(file)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
  const encrypted = encryptStore(store, passphrase)
  writeFileSync(file, encrypted, { mode: 0o600 })
}

async function tryKeytar(): Promise<typeof Keytar | null> {
  try {
    const kt = await import('keytar')
    return kt as typeof Keytar
  } catch {
    return null
  }
}

export async function setSecret(service: string, account: string, secret: string): Promise<void> {
  // When CLAW_SECRETS_FILE is set (test override) or passphrase env is set → use fallback
  if (process.env['CLAW_SECRETS_FILE'] || process.env['CLAW_SECRET_PASSPHRASE']) {
    const passphrase = getPassphrase()
    const store = loadStore(passphrase)
    if (!store[service]) store[service] = {}
    const svcStore = store[service]
    if (svcStore) svcStore[account] = secret
    saveStore(store, passphrase)
    return
  }

  const kt = await tryKeytar()
  if (kt) {
    await kt.setPassword(service, account, secret)
    return
  }

  // Headless fallback — passphrase required
  const passphrase = getPassphrase()
  const store = loadStore(passphrase)
  if (!store[service]) store[service] = {}
  const svcStore = store[service]
  if (svcStore) svcStore[account] = secret
  saveStore(store, passphrase)
}

export async function getSecret(service: string, account: string): Promise<string | null> {
  if (process.env['CLAW_SECRETS_FILE'] || process.env['CLAW_SECRET_PASSPHRASE']) {
    const passphrase = getPassphrase()
    const store = loadStore(passphrase)
    return store[service]?.[account] ?? null
  }

  const kt = await tryKeytar()
  if (kt) {
    return kt.getPassword(service, account)
  }

  const passphrase = getPassphrase()
  const store = loadStore(passphrase)
  return store[service]?.[account] ?? null
}

export async function deleteSecret(service: string, account: string): Promise<boolean> {
  if (process.env['CLAW_SECRETS_FILE'] || process.env['CLAW_SECRET_PASSPHRASE']) {
    const passphrase = getPassphrase()
    const store = loadStore(passphrase)
    if (!store[service]?.[account]) return false
    const svcStore = store[service]
    if (svcStore) delete svcStore[account]
    saveStore(store, passphrase)
    return true
  }

  const kt = await tryKeytar()
  if (kt) {
    return kt.deletePassword(service, account)
  }

  const passphrase = getPassphrase()
  const store = loadStore(passphrase)
  if (!store[service]?.[account]) return false
  const svcStore = store[service]
  if (svcStore) delete svcStore[account]
  saveStore(store, passphrase)
  return true
}
