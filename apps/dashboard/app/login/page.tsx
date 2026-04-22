'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Circle, Eye, EyeOff, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [needsTotp, setNeedsTotp] = useState(false)
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
      const data = (await res.json()) as { ok?: boolean; error?: string; needsTotp?: boolean }

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
      router.push(next)
      router.refresh()
    } catch {
      setError('Connection error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Circle size={12} className="text-white fill-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">open-greg</span>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={15} className="text-gray-500" />
            <h1 className="text-sm font-semibold text-white">Sign in</h1>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {!needsTotp ? (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Username</label>
                  <input
                    autoFocus
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  Enter the 6-digit code from your authenticator app.
                </p>
                <label className="text-xs text-gray-500 mb-1.5 block">Authenticator code</label>
                <input
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.3em] text-center placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
            >
              {loading ? 'Signing in…' : needsTotp ? 'Verify' : 'Sign in'}
            </button>

            {needsTotp && (
              <button
                type="button"
                onClick={() => {
                  setNeedsTotp(false)
                  setTotp('')
                }}
                className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
              >
                Back
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">open-greg · local instance</p>
      </div>
    </div>
  )
}
