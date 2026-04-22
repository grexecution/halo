// HMAC-SHA256 session tokens using Node.js built-in crypto (no edge/web crypto needed)
import { createHmac, randomBytes } from 'node:crypto'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(data: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest())
}

export function signSession(username: string, secret: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = b64url(
    Buffer.from(
      JSON.stringify({ sub: username, exp: Math.floor((Date.now() + SESSION_DURATION_MS) / 1000) }),
    ),
  )
  const sig = sign(`${header}.${payload}`, secret)
  return `${header}.${payload}.${sig}`
}

export function verifySession(token: string, secret: string): { username: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, payload, sig] = parts as [string, string, string]
    const expected = sign(`${header}.${payload}`, secret)
    if (sig !== expected) return null
    const data = JSON.parse(b64urlDecode(payload).toString()) as { sub: string; exp: number }
    if (data.exp < Math.floor(Date.now() / 1000)) return null
    return { username: data.sub }
  } catch {
    return null
  }
}

export function generateSessionSecret(): string {
  return randomBytes(32).toString('hex')
}

export const SESSION_COOKIE = 'og_session'
