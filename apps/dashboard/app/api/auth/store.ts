import bcrypt from 'bcryptjs'
import { getDb } from '../../lib/db'
import { generateSessionSecret } from './session'

export interface AuthConfig {
  enabled: boolean
  username: string
  passwordHash: string
  totpEnabled: boolean
  totpSecret: string
  sessionSecret: string
}

const DEFAULT: AuthConfig = {
  enabled: false,
  username: 'admin',
  passwordHash: '',
  totpEnabled: false,
  totpSecret: '',
  sessionSecret: generateSessionSecret(),
}

export function readAuthConfig(): AuthConfig {
  const db = getDb()
  const row = db
    .prepare(
      'SELECT enabled, username, password_hash, totp_enabled, totp_secret, session_secret FROM auth WHERE id = 1',
    )
    .get() as
    | {
        enabled: number
        username: string
        password_hash: string
        totp_enabled: number
        totp_secret: string
        session_secret: string
      }
    | undefined

  if (!row) return { ...DEFAULT }

  return {
    enabled: row.enabled === 1,
    username: row.username,
    passwordHash: row.password_hash,
    totpEnabled: row.totp_enabled === 1,
    totpSecret: row.totp_secret,
    sessionSecret: row.session_secret || DEFAULT.sessionSecret,
  }
}

export function writeAuthConfig(config: AuthConfig): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO auth (id, enabled, username, password_hash, totp_enabled, totp_secret, session_secret)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       username = excluded.username,
       password_hash = excluded.password_hash,
       totp_enabled = excluded.totp_enabled,
       totp_secret = excluded.totp_secret,
       session_secret = excluded.session_secret`,
  ).run(
    config.enabled ? 1 : 0,
    config.username,
    config.passwordHash,
    config.totpEnabled ? 1 : 0,
    config.totpSecret,
    config.sessionSecret,
  )
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getSessionSecret(): string {
  return readAuthConfig().sessionSecret || generateSessionSecret()
}
