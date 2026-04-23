'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [totp, setTotp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [needsTotp, setNeedsTotp] = useState(false)
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username,
          password,
          ...(needsTotp ? { totp } : {}),
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        needsTotp?: boolean
        mustChangePassword?: boolean
      }
      if (data.needsTotp) {
        setNeedsTotp(true)
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(data.error ?? 'Invalid credentials')
        setLoading(false)
        return
      }
      if (data.mustChangePassword) {
        setNeedsPasswordChange(true)
        setLoading(false)
        return
      }
      window.location.href = next
    } catch {
      setError('Connection error')
      setLoading(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change-password', newPassword }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Failed to change password')
        setLoading(false)
        return
      }
      window.location.href = next
    } catch {
      setError('Connection error')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#0f0f0f] border-r border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-black" />
          </div>
          <span className="text-white font-semibold tracking-tight">Halo</span>
        </div>

        <div>
          <blockquote className="text-2xl font-light text-white/80 leading-relaxed mb-4">
            "Your personal AI that never stops working."
          </blockquote>
          <p className="text-sm text-white/30">Self-hosted · Private · Autonomous</p>
        </div>

        <div className="text-xs text-white/20">Halo v0.1.0</div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-black" />
          </div>
          <span className="text-white font-semibold tracking-tight">Halo</span>
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-white mb-1">
              {needsPasswordChange
                ? 'Set a new password'
                : needsTotp
                  ? 'Two-factor auth'
                  : 'Welcome back'}
            </h1>
            <p className="text-sm text-white/40">
              {needsPasswordChange
                ? "Choose a password you'll remember"
                : needsTotp
                  ? 'Enter the code from your authenticator app'
                  : 'Sign in to your instance'}
            </p>
          </div>

          {needsPasswordChange && (
            <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  New password
                </label>
                <input
                  autoFocus
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  required
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <div className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Saving…' : 'Set password & continue'}
                </button>
              </div>
            </form>
          )}

          {!needsPasswordChange && (
            <>
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
                {!needsTotp ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                        Username
                      </label>
                      <input
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        autoComplete="username"
                        required
                        className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          required
                          className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 pr-11 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                      Authenticator code
                    </label>
                    <input
                      autoFocus
                      value={totp}
                      onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white font-mono tracking-[0.4em] text-center placeholder-white/20 focus:outline-none focus:border-white/30 transition-all"
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <div className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Signing in…' : needsTotp ? 'Verify' : 'Sign in'}
                  </button>
                </div>

                {needsTotp && (
                  <button
                    type="button"
                    onClick={() => {
                      setNeedsTotp(false)
                      setTotp('')
                    }}
                    className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-1"
                  >
                    ← Back
                  </button>
                )}
              </form>

              {!needsTotp && (
                <p className="mt-8 text-center text-xs text-white/20">
                  Auth disabled? Any credentials will work.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
