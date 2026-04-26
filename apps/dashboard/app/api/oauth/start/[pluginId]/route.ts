export const dynamic = 'force-dynamic'
/**
 * GET /api/oauth/start/[pluginId]
 *
 * Initiates an OAuth2 flow for the given plugin.
 * - Looks up the provider config (authUrl, scopes, pkce flag)
 * - Auto-detects the redirect_uri (tunnel URL if active, else http://localhost:PORT)
 * - Generates a PKCE pair + state nonce, persists them in oauth_states (5-min TTL)
 * - Returns { authUrl, redirectUri } so the client can open a popup
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { getDb } from '../../../../lib/db'
import {
  getProviderConfig,
  PLUGIN_TO_PROVIDER,
  GOOGLE_PLUGIN_IDS,
} from '@open-greg/connectors/oauth-configs'

function generateState(): string {
  return randomBytes(24).toString('hex')
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

function detectRedirectUri(): string {
  const port = process.env['PORT'] ?? '3000'
  const db = getDb()
  // Check if Cloudflare tunnel is active
  const tunnel = db
    .prepare('SELECT url FROM tunnel WHERE id = 1 AND running = 1 AND url IS NOT NULL')
    .get() as { url: string } | undefined
  const base = tunnel?.url ?? `http://localhost:${port}`
  return `${base}/api/oauth/callback`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ pluginId: string }> }) {
  const { pluginId } = await params
  const config = getProviderConfig(pluginId)
  if (!config) {
    return NextResponse.json(
      { error: `No OAuth config found for plugin: ${pluginId}` },
      { status: 400 },
    )
  }

  const providerKey = PLUGIN_TO_PROVIDER[pluginId]!
  const redirectUri = detectRedirectUri()

  // Allow scope override via ?scopes= query param (comma-separated)
  const scopeParam = req.nextUrl.searchParams.get('scopes')
  const scopes = scopeParam ? scopeParam.split(',').filter(Boolean) : config.defaultScopes

  // For Google: if connecting a single product (not google-workspace directly),
  // still use the full workspace scopes so one consent covers everything
  const finalScopes = GOOGLE_PLUGIN_IDS.has(pluginId) ? config.defaultScopes : scopes

  // Generate state + optional PKCE
  const state = generateState()
  const { codeVerifier, codeChallenge } = generatePKCE()

  // Store in oauth_states (5-min TTL enforced by cleanup or just checking created_at on callback)
  const db = getDb()

  // Clean up expired states (>10 min old)
  db.prepare(`DELETE FROM oauth_states WHERE created_at < datetime('now', '-10 minutes')`).run()

  db.prepare(
    `INSERT INTO oauth_states (id, plugin_id, provider_key, code_verifier, redirect_uri)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(state, pluginId, providerKey, codeVerifier, redirectUri)

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: '', // Client fills this in — we don't store it here. See below.
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: finalScopes.join(' '),
    state,
    access_type: 'offline', // Google: get refresh token
    prompt: 'consent', // Google: always show consent (ensures refresh token)
  })

  if (config.pkce) {
    authParams.set('code_challenge', codeChallenge)
    authParams.set('code_challenge_method', 'S256')
  }

  // ── Resolve client_id / client_secret ────────────────────────────────────
  // Priority: env vars (set once by admin) → stored plugin credentials → needsClientId
  const envPrefix = providerKey.toUpperCase().replace(/-/g, '_') // e.g. GOOGLE_WORKSPACE
  const envClientId =
    process.env[`${envPrefix}_CLIENT_ID`] ??
    // Common shorthand aliases
    (GOOGLE_PLUGIN_IDS.has(pluginId) ? (process.env['GOOGLE_CLIENT_ID'] ?? '') : '') ??
    (providerKey === 'slack' ? (process.env['SLACK_CLIENT_ID'] ?? '') : '') ??
    (providerKey === 'linear' ? (process.env['LINEAR_CLIENT_ID'] ?? '') : '') ??
    (providerKey === 'github' ? (process.env['GITHUB_CLIENT_ID'] ?? '') : '') ??
    (providerKey === 'dropbox' ? (process.env['DROPBOX_CLIENT_ID'] ?? '') : '') ??
    (providerKey === 'microsoft' ? (process.env['MICROSOFT_CLIENT_ID'] ?? '') : '') ??
    ''

  // Also check stored plugin credentials (DB)
  const stored = db
    .prepare('SELECT fields FROM plugin_credentials WHERE plugin_id = ?')
    .get(pluginId) as { fields: string } | undefined

  const googleEntry = GOOGLE_PLUGIN_IDS.has(pluginId)
    ? (db
        .prepare('SELECT fields FROM plugin_credentials WHERE plugin_id = ?')
        .get('google-workspace') as { fields: string } | undefined)
    : undefined

  const storedFields = JSON.parse(stored?.fields ?? googleEntry?.fields ?? '{}') as Record<
    string,
    string
  >

  const clientId = envClientId || storedFields['client_id'] || ''

  if (!clientId) {
    return NextResponse.json(
      {
        error: 'client_id not configured',
        needsClientId: true,
        redirectUri,
        // Tell the UI which env var to set for zero-UX setup
        envVar: GOOGLE_PLUGIN_IDS.has(pluginId) ? 'GOOGLE_CLIENT_ID' : `${envPrefix}_CLIENT_ID`,
      },
      { status: 422 },
    )
  }

  authParams.set('client_id', clientId)
  const authUrl = `${config.authUrl}?${authParams.toString()}`

  return NextResponse.json({ authUrl, redirectUri, state })
}
