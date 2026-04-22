'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Wifi,
  WifiOff,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  RefreshCw,
  Terminal,
  Server,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button, Card, CardContent, Switch, cn } from '../components/ui/index'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TunnelStatus {
  installed: boolean
  running: boolean
  url: string | null
  startedAt: string | null
  pid: number | null
}

interface AuthStatus {
  enabled: boolean
  username: string
  totpEnabled: boolean
  hasPassword: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

// ─── Tunnel Section ───────────────────────────────────────────────────────────

function TunnelSection() {
  const [status, setStatus] = useState<TunnelStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  const poll = useCallback(async () => {
    const res = await fetch('/api/expose')
    setStatus((await res.json()) as TunnelStatus)
  }, [])

  useEffect(() => {
    void poll()
    const t = setInterval(() => void poll(), 5000)
    return () => clearInterval(t)
  }, [poll])

  async function start() {
    setLoading(true)
    const res = await fetch('/api/expose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', port: 3000 }),
    })
    const data = (await res.json()) as { url?: string; error?: string }
    setLoading(false)
    if (data.url) await poll()
  }

  async function stop() {
    setLoading(true)
    await fetch('/api/expose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    })
    setLoading(false)
    await poll()
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 py-4">
        <RefreshCw size={14} className="text-gray-600 animate-spin" />
        <span className="text-xs text-gray-600">Checking tunnel status…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-xl border',
          status.running ? 'bg-green-900/20 border-green-800/50' : 'bg-gray-900/60 border-gray-800',
        )}
      >
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            status.running ? 'bg-green-400 animate-pulse' : 'bg-gray-600',
          )}
        />
        <div className="flex-1 min-w-0">
          {status.running && status.url ? (
            <>
              <p className="text-xs font-medium text-white mb-0.5">Tunnel active</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-green-300 truncate">{status.url}</span>
                <CopyButton text={status.url} />
                <a
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-400"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              Tunnel not running — dashboard is only accessible at localhost:3000
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {status.running ? (
            <Button variant="outline" size="sm" onClick={() => void stop()} disabled={loading}>
              {loading ? <RefreshCw size={12} className="animate-spin" /> : <WifiOff size={12} />}
              Stop
            </Button>
          ) : !status.installed ? null : (
            <Button variant="default" size="sm" onClick={() => void start()} disabled={loading}>
              {loading ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
              Start tunnel
            </Button>
          )}
        </div>
      </div>

      {/* Not installed */}
      {!status.installed && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-800/40 rounded-xl">
            <AlertTriangle size={15} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white mb-1">cloudflared not installed</p>
              <p className="text-xs text-gray-400">
                Install the Cloudflare tunnel client to expose this dashboard to the internet for
                free, with no port forwarding required.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowInstall((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showInstall ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Show install instructions
          </button>

          {showInstall && (
            <div className="space-y-3">
              <InstallBlock
                title="Linux (amd64)"
                cmd={`curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared`}
              />
              <InstallBlock
                title="Linux (arm64 / Raspberry Pi)"
                cmd={`curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared`}
              />
              <InstallBlock title="macOS (Homebrew)" cmd="brew install cloudflared" />
              <p className="text-xs text-gray-600">
                After installing, click the refresh button above or restart this page.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info cards */}
      {status.installed && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
            <Server size={14} className="text-gray-600 mb-2" />
            <p className="text-xs font-medium text-white mb-0.5">Quick tunnel</p>
            <p className="text-[11px] text-gray-500">
              Random *.trycloudflare.com URL. No account needed. Changes on restart.
            </p>
          </div>
          <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
            <Globe size={14} className="text-gray-600 mb-2" />
            <p className="text-xs font-medium text-white mb-0.5">Custom domain</p>
            <p className="text-[11px] text-gray-500">
              Get a permanent URL by adding a CNAME to your domain.
            </p>
          </div>
        </div>
      )}

      {/* Custom domain DNS instructions */}
      {status.running && status.url && <DnsInstructions tunnelUrl={status.url} />}
    </div>
  )
}

function InstallBlock({ title, cmd }: { title: string; cmd: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-gray-500 font-medium">{title}</p>
      <div className="flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-lg p-3">
        <Terminal size={12} className="text-gray-600 flex-shrink-0 mt-0.5" />
        <code className="text-[11px] text-green-300 font-mono flex-1 break-all">{cmd}</code>
        <CopyButton text={cmd} />
      </div>
    </div>
  )
}

function DnsInstructions({ tunnelUrl }: { tunnelUrl: string }) {
  const hostname = tunnelUrl.replace(/^https?:\/\//, '')
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-gray-500" />
          <span className="text-xs font-medium text-white">Use a custom domain</span>
        </div>
        {open ? (
          <ChevronDown size={14} className="text-gray-600" />
        ) : (
          <ChevronRight size={14} className="text-gray-600" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 pt-3">
            Add this DNS record to your domain provider (Cloudflare, Namecheap, etc.):
          </p>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 text-blue-300">CNAME</td>
                  <td className="px-3 py-2 text-gray-300">dashboard</td>
                  <td className="px-3 py-2 text-gray-300 flex items-center gap-2">
                    <span className="truncate">{hostname}</span>
                    <CopyButton text={hostname} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-600">
            After adding the record, your dashboard will be accessible at{' '}
            <span className="text-gray-400">dashboard.yourdomain.com</span>. DNS propagation takes
            1–5 minutes.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Auth Section ─────────────────────────────────────────────────────────────

function AuthSection() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // TOTP setup flow
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')

  const loadAuth = useCallback(async () => {
    const res = await fetch('/api/auth')
    setAuth((await res.json()) as AuthStatus)
  }, [])

  useEffect(() => {
    void loadAuth()
  }, [loadAuth])

  async function saveAuth(enable: boolean) {
    if (enable && (!newUsername.trim() || !newPassword.trim())) {
      setError('Username and password are required')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setup',
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
        ...(enable ? {} : { disableAuth: true }),
      }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to save')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await loadAuth()
    setNewPassword('')
  }

  async function startTotpSetup() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'totp-setup' }),
    })
    const data = (await res.json()) as { secret?: string; qrDataUrl?: string }
    if (data.secret && data.qrDataUrl) {
      setTotpSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl })
    }
  }

  async function confirmTotp() {
    if (!totpSetup || totpCode.length !== 6) return
    setTotpError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'totp-confirm',
        totpToken: totpCode,
        enableTotp: totpSetup.secret,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok) {
      setTotpError(data.error ?? 'Invalid code')
      return
    }
    setTotpSetup(null)
    setTotpCode('')
    await loadAuth()
  }

  async function disableTotp() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'totp-disable' }),
    })
    await loadAuth()
  }

  if (!auth) return <div className="h-8 animate-pulse bg-gray-800 rounded-lg" />

  return (
    <div className="space-y-5">
      {/* Enable/disable auth */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Require authentication</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Protect the dashboard with a username and password.
          </p>
        </div>
        <Switch checked={auth.enabled} onChange={(v) => void saveAuth(v)} />
      </div>

      {/* Credentials setup */}
      <div
        className={cn(
          'space-y-3 transition-opacity',
          !auth.enabled && newUsername === '' && newPassword === '' && 'opacity-60',
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Username</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              placeholder={auth.username || 'admin'}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                placeholder={auth.hasPassword ? '(unchanged)' : 'set a password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="sm"
            onClick={() => void saveAuth(true)}
            disabled={saving || (!newUsername.trim() && !newPassword.trim())}
          >
            {saving ? 'Saving…' : 'Save credentials'}
          </Button>
          {saved && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check size={11} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* 2FA / TOTP */}
      {auth.enabled && (
        <div className="border-t border-gray-800 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone size={14} className="text-gray-500" />
              <div>
                <p className="text-sm font-medium text-white">Two-factor authentication</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  TOTP via any authenticator app (Google Authenticator, Authy, 1Password).
                </p>
              </div>
            </div>
            {auth.totpEnabled ? (
              <Button variant="outline" size="sm" onClick={() => void disableTotp()}>
                Disable
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={() => void startTotpSetup()}>
                Enable
              </Button>
            )}
          </div>

          {auth.totpEnabled && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/40 rounded-lg">
              <Shield size={13} className="text-green-400" />
              <span className="text-xs text-green-400">2FA is active</span>
            </div>
          )}

          {/* TOTP setup flow */}
          {totpSetup && (
            <div className="mt-3 p-4 bg-gray-900 border border-gray-800 rounded-xl space-y-4">
              <p className="text-xs text-gray-300">
                Scan this QR code with your authenticator app, then enter the 6-digit code to
                confirm.
              </p>
              <div className="flex justify-center">
                <img
                  src={totpSetup.qrDataUrl}
                  alt="TOTP QR code"
                  width={160}
                  height={160}
                  className="rounded-lg bg-white p-2"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] text-gray-600">
                  Or enter the key manually:{' '}
                  <span className="font-mono text-gray-400">{totpSetup.secret}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.3em] text-center placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void confirmTotp()}
                  disabled={totpCode.length !== 6}
                >
                  Verify
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTotpSetup(null)
                    setTotpCode('')
                  }}
                >
                  Cancel
                </Button>
              </div>
              {totpError && <p className="text-xs text-red-400">{totpError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExposePage() {
  return (
    <main className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Expose</h1>
        <p className="text-sm text-gray-500 mt-1">
          Make this dashboard publicly accessible — with auth and optional 2FA.
        </p>
      </div>

      {/* Tunnel */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Public tunnel
          </h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            <TunnelSection />
          </CardContent>
        </Card>
      </section>

      {/* Auth */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Authentication
          </h2>
        </div>
        <Card>
          <CardContent className="pt-4">
            <AuthSection />
          </CardContent>
        </Card>
      </section>

      {/* Recommendations */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Recommendations
          </h2>
        </div>
        <div className="space-y-2 text-xs text-gray-500">
          {[
            'Always enable authentication before starting a public tunnel.',
            'Cloudflare quick tunnels are HTTPS by default — traffic is encrypted.',
            'Quick tunnel URLs change on restart. For a permanent URL, use a named tunnel with a custom domain.',
            'Rotate your password periodically. TOTP adds strong protection if the URL is discovered.',
            'The tunnel runs as a background process. It stops when this server process stops.',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-gray-700 mt-0.5">·</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
