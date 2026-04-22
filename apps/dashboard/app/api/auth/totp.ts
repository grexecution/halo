// RFC 6238 TOTP implementation using Node.js built-in crypto
import { createHmac, randomBytes } from 'node:crypto'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(s: string): Buffer {
  let bits = 0
  let val = 0
  const output: number[] = []
  for (const c of s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')) {
    const idx = CHARS.indexOf(c)
    if (idx < 0) continue
    val = (val << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((val >> bits) & 0xff)
    }
  }
  return Buffer.from(output)
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8)
  const hi = Math.floor(counter / 0x100000000)
  const lo = counter >>> 0
  buf.writeUInt32BE(hi, 0)
  buf.writeUInt32BE(lo, 4)
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0xf
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

export function generateSecret(): string {
  const bytes = randomBytes(20)
  let result = ''
  for (let i = 0; i < 20; i++) result += CHARS[bytes[i]! % 32]
  return result
}

export function generateCode(secret: string): string {
  return hotp(secret, Math.floor(Date.now() / 1000 / 30))
}

export function verifyCode(token: string, secret: string, window = 1): boolean {
  const step = Math.floor(Date.now() / 1000 / 30)
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, step + i) === token) return true
  }
  return false
}

export function keyUri(secret: string, account: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
