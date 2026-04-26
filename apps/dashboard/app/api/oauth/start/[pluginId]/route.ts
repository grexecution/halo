export const dynamic = 'force-dynamic'
/**
 * GET /api/oauth/start/[pluginId]
 *
 * Initiates an OAuth2 flow for the given plugin.
 * Credential resolution order (Windmill-style):
 *   1. Admin DB settings  (Settings → OAuth Apps in dashboard)
 *   2. Env vars           (GOOGLE_CLIENT_ID / SLACK_CLIENT_ID / etc.)
 *   3. needsSetup: true   → redirect admin to /settings?tab=oauth
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { getDb } from '../../../../lib/db'
import {
  getProviderConfig,
  PLUGIN_TO_PROVIDER,
  GOOGLE_PLUGIN_IDS,
  PROVIDER_ENV_PREFIX,
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
  const tunnel = db
    .prepare('SELECT url FROM tunnel WHERE id = 1 AND running = 1 AND url IS NOT NULL')
    .get() as { url: string } | undefined
  const base = tunnel?.url ?? `http://localhost:${port}`
  return `${base}/api/oauth/callback`
}

/** Read admin-saved OAuth apps from settings DB */
function readOAuthApps(): Record<string, { id: string; secret: string }> {
  const db = getDb()
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined
  if (!row) return {}
  try {
    const parsed = JSON.parse(row.data) as Record<string, unknown>
    return (parsed['oauth_apps'] as Record<string, { id: string; secret: string }>) ?? {}
  } catch {
    return {}
  }
}

/** Resolve client_id for a provider. Priority: DB → env → empty */
function resolveClientId(providerKey: string): string {
  const apps = readOAuthApps()
  if (apps[providerKey]?.id) return apps[providerKey].id

  // Env var: use PROVIDER_ENV_PREFIX map, e.g. 'google-workspace' → 'GOOGLE'
  const envKey = PROVIDER_ENV_PREFIX[providerKey] ?? providerKey.toUpperCase().replace(/-/g, '_')
  return process.env[`${envKey}_CLIENT_ID`] ?? ''
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

  const scopeParam = req.nextUrl.searchParams.get('scopes')
  const scopes = scopeParam ? scopeParam.split(',').filter(Boolean) : config.defaultScopes
  const finalScopes = GOOGLE_PLUGIN_IDS.has(pluginId) ? config.defaultScopes : scopes

  const clientId = resolveClientId(providerKey)

  if (!clientId) {
    return NextResponse.json(
      {
        needsSetup: true,
        provider: providerKey,
        redirectUri,
        settingsUrl: '/settings?tab=oauth',
      },
      { status: 422 },
    )
  }

  const state = generateState()
  const { codeVerifier, codeChallenge } = generatePKCE()

  const db = getDb()
  db.prepare(`DELETE FROM oauth_states WHERE created_at < datetime('now', '-10 minutes')`).run()
  db.prepare(
    `INSERT INTO oauth_states (id, plugin_id, provider_key, code_verifier, redirect_uri)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(state, pluginId, providerKey, codeVerifier, redirectUri)

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: finalScopes.join(' '),
    state,
  })

  // Provider-specific extras
  if (providerKey === 'google-workspace') {
    authParams.set('access_type', 'offline')
    authParams.set('prompt', 'consent')
  }

  if (config.pkce) {
    authParams.set('code_challenge', codeChallenge)
    authParams.set('code_challenge_method', 'S256')
  }

  const authUrl = `${config.authUrl}?${authParams.toString()}`
  return NextResponse.json({ authUrl, redirectUri, state })
}
