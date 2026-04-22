import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import bcrypt from 'bcryptjs'
import { generateSessionSecret } from './session'

const DIR = join(homedir(), '.open-greg')
const FILE = join(DIR, 'auth.json')

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

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

export function readAuthConfig(): AuthConfig {
  if (!existsSync(FILE)) return { ...DEFAULT }
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<AuthConfig>
    return { ...DEFAULT, ...raw }
  } catch {
    return { ...DEFAULT }
  }
}

export function writeAuthConfig(config: AuthConfig): void {
  ensureDir()
  writeFileSync(FILE, JSON.stringify(config, null, 2), 'utf-8')
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
