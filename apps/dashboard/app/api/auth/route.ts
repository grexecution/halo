import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { readAuthConfig, writeAuthConfig, hashPassword, verifyPassword } from './store'
import { signSession, verifySession, SESSION_COOKIE } from './session'
import { generateSecret as totpGenerateSecret, verifyCode, keyUri } from './totp'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
}

function requireSession(req: NextRequest, cfg: ReturnType<typeof readAuthConfig>): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (!cookie) return false
  return verifySession(cookie, cfg.sessionSecret) !== null
}

// GET — public auth status (no secrets)
export function GET() {
  const cfg = readAuthConfig()
  return NextResponse.json({
    enabled: cfg.enabled,
    username: cfg.username,
    totpEnabled: cfg.totpEnabled,
    hasPassword: cfg.passwordHash !== '',
  })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>
  const action = String(body.action)
  const cfg = readAuthConfig()

  if (action === 'login') {
    if (!cfg.enabled) {
      // Auth not enabled — issue a cookie and let them through
      const token = signSession('admin', cfg.sessionSecret)
      const res = NextResponse.json({ ok: true })
      res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS)
      return res
    }
    if (String(body.username) !== cfg.username)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    const pwOk = await verifyPassword(String(body.password), cfg.passwordHash)
    if (!pwOk) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    if (cfg.totpEnabled) {
      if (!body.totp)
        return NextResponse.json({ error: 'TOTP required', needsTotp: true }, { status: 401 })
      if (!verifyCode(String(body.totp), cfg.totpSecret))
        return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 401 })
    }
    const token = signSession(cfg.username, cfg.sessionSecret)
    const res = NextResponse.json({ ok: true, mustChangePassword: cfg.mustChangePassword })
    res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS)
    return res
  }

  if (action === 'change-password') {
    if (!requireSession(req, cfg))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const newPassword = String(body.newPassword ?? '')
    if (newPassword.length < 8)
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    const hash = await hashPassword(newPassword)
    writeAuthConfig({ ...cfg, passwordHash: hash, mustChangePassword: false })
    return NextResponse.json({ ok: true })
  }

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  if (action === 'setup') {
    if (cfg.enabled && !requireSession(req, cfg))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const updated = { ...cfg }
    if (body.newUsername) updated.username = String(body.newUsername)
    if (body.newPassword) updated.passwordHash = await hashPassword(String(body.newPassword))
    updated.enabled = !body.disableAuth
    if (body.disableAuth) updated.totpEnabled = false
    writeAuthConfig(updated)
    // Issue a fresh session after setup
    const token = signSession(updated.username, updated.sessionSecret)
    const res = NextResponse.json({ ok: true, enabled: updated.enabled })
    res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS)
    return res
  }

  if (action === 'totp-setup') {
    if (!requireSession(req, cfg))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const secret = totpGenerateSecret()
    const otpauth = keyUri(secret, cfg.username, 'open-greg')
    const qrDataUrl = await QRCode.toDataURL(otpauth)
    return NextResponse.json({ secret, qrDataUrl, otpauth })
  }

  if (action === 'totp-confirm') {
    if (!requireSession(req, cfg))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // body.enableTotp = the TOTP secret string; body.totpToken = the 6-digit code
    const totpSecret = String(body.enableTotp)
    const code = String(body.totpToken)
    if (!verifyCode(code, totpSecret))
      return NextResponse.json({ error: 'Invalid code — please try again' }, { status: 400 })
    writeAuthConfig({ ...cfg, totpEnabled: true, totpSecret })
    return NextResponse.json({ ok: true })
  }

  if (action === 'totp-disable') {
    if (!requireSession(req, cfg))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    writeAuthConfig({ ...cfg, totpEnabled: false, totpSecret: '' })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
