'use client'
/**
 * /oauth-success
 * This page is opened in a popup window after OAuth callback.
 * It sends a message to the opener window then closes itself.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'
import { Suspense } from 'react'

function OAuthSuccessInner() {
  const searchParams = useSearchParams()
  const pluginId = searchParams.get('plugin') ?? ''
  const error = searchParams.get('error') ?? ''
  const [countdown, setCountdown] = useState(3)

  const success = !error && !!pluginId

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Notify the parent window
    if (window.opener) {
      window.opener.postMessage(
        success ? { type: 'oauth_success', pluginId } : { type: 'oauth_error', error },
        window.location.origin,
      )
    }

    // Auto-close after 3 seconds
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          window.close()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [success, pluginId, error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-2">Connected!</h1>
            <p className="text-sm text-muted-foreground">
              Your account has been connected successfully.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-4">Closing in {countdown}s…</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-900/40 border border-red-700 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-2">Connection failed</h1>
            <p className="text-sm text-muted-foreground">
              {error === 'access_denied'
                ? 'You declined the permission request.'
                : error === 'invalid_state'
                  ? 'Security check failed. Please try again.'
                  : error === 'missing_params'
                    ? 'Something went wrong with the OAuth flow.'
                    : `Error: ${error}`}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-4">Closing in {countdown}s…</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function OAuthSuccessPage() {
  return (
    <Suspense>
      <OAuthSuccessInner />
    </Suspense>
  )
}
