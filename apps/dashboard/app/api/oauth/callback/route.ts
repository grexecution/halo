export const dynamic = 'force-dynamic'
/**
 * GET /api/oauth/callback?code=...&state=...
 *
 * Handles the OAuth2 authorization code callback from providers.
 * - Validates state against oauth_states table
 * - Exchanges code for access_token + refresh_token (using PKCE verifier)
 * - Stores tokens in plugin_credentials
 * - Redirects to /oauth-success?plugin=...
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../../lib/db'
import {
  OAUTH_PROVIDER_CONFIGS,
  GOOGLE_PLUGIN_IDS,
  PROVIDER_ENV_PREFIX,
} from '@open-greg/connectors/oauth-configs'

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  authed_user?: { access_token?: string }
  error?: string
}

/** Read admin-saved OAuth apps from settings DB */
function readOAuthApp(providerKey: string): { id: string; secret: string } | undefined {
  const db = getDb()
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get() as
    | { data: string }
    | undefined
  if (!row) return undefined
  try {
    const parsed = JSON.parse(row.data) as Record<string, unknown>
    const apps = parsed['oauth_apps'] as Record<string, { id: string; secret: string }> | undefined
    return apps?.[providerKey]
  } catch {
    return undefined
  }
}

function resolveCredentials(providerKey: string): { clientId: string; clientSecret: string } {
  // 1. Admin DB settings
  const app = readOAuthApp(providerKey)
  if (app?.id) return { clientId: app.id, clientSecret: app.secret }

  // 2. Env vars
  const envKey = PROVIDER_ENV_PREFIX[providerKey] ?? providerKey.toUpperCase().replace(/-/g, '_')
  const clientId = process.env[`${envKey}_CLIENT_ID`] ?? ''
  const clientSecret = process.env[`${envKey}_CLIENT_SECRET`] ?? ''
  return { clientId, clientSecret }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/oauth-success?error=${encodeURIComponent(error)}`, req.url),
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/oauth-success?error=missing_params', req.url))
  }

  const db = getDb()

  const stateRow = db
    .prepare(
      'SELECT plugin_id, provider_key, code_verifier, redirect_uri FROM oauth_states WHERE id = ?',
    )
    .get(state) as
    | {
        plugin_id: string
        provider_key: string
        code_verifier: string
        redirect_uri: string
      }
    | undefined

  if (!stateRow) {
    return NextResponse.redirect(new URL('/oauth-success?error=invalid_state', req.url))
  }
  db.prepare('DELETE FROM oauth_states WHERE id = ?').run(state)

  const providerConfig = OAUTH_PROVIDER_CONFIGS[stateRow.provider_key]
  if (!providerConfig) {
    return NextResponse.redirect(new URL('/oauth-success?error=unknown_provider', req.url))
  }

  const { clientId, clientSecret } = resolveCredentials(stateRow.provider_key)

  if (!clientId) {
    return NextResponse.redirect(new URL('/oauth-success?error=no_client_id', req.url))
  }

  const tokenParams: Record<string, string> = {
    code,
    client_id: clientId,
    redirect_uri: stateRow.redirect_uri,
    grant_type: 'authorization_code',
  }

  if (providerConfig.clientSecretInBody && clientSecret) {
    tokenParams['client_secret'] = clientSecret
  }

  if (providerConfig.pkce) {
    tokenParams['code_verifier'] = stateRow.code_verifier
  }

  let tokenData: TokenResponse
  try {
    const tokenRes = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: new URLSearchParams(tokenParams).toString(),
      signal: AbortSignal.timeout(15_000),
    })

    const text = await tokenRes.text()
    // GitHub returns URL-encoded response, others return JSON
    if (text.startsWith('access_token=') || text.includes('&access_token=')) {
      const parsed = new URLSearchParams(text)
      const rt = parsed.get('refresh_token')
      const sc = parsed.get('scope')
      tokenData = {
        access_token: parsed.get('access_token') ?? '',
        token_type: parsed.get('token_type') ?? 'bearer',
        ...(rt ? { refresh_token: rt } : {}),
        ...(sc ? { scope: sc } : {}),
      }
    } else {
      tokenData = JSON.parse(text) as TokenResponse
    }

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL(
          `/oauth-success?error=${encodeURIComponent(String(tokenData.error ?? 'token_exchange_failed'))}`,
          req.url,
        ),
      )
    }
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/oauth-success?error=${encodeURIComponent(String(err))}`, req.url),
    )
  }

  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  // For Google: store under canonical 'google-workspace' key
  const targetPluginId = GOOGLE_PLUGIN_IDS.has(stateRow.plugin_id)
    ? 'google-workspace'
    : stateRow.plugin_id

  const connectedAt = new Date().toISOString()

  const upsertCredential = db.prepare(
    `INSERT INTO plugin_credentials
       (plugin_id, fields, access_token, refresh_token, token_expires_at, scopes, token_type, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(plugin_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, refresh_token),
       token_expires_at = excluded.token_expires_at,
       scopes = excluded.scopes,
       token_type = excluded.token_type,
       connected_at = excluded.connected_at`,
  )

  const baseArgs = [
    tokenData.access_token,
    tokenData.refresh_token ?? null,
    tokenExpiresAt,
    tokenData.scope ?? null,
    tokenData.token_type ?? 'Bearer',
    connectedAt,
  ] as const

  upsertCredential.run(targetPluginId, '{}', ...baseArgs)

  // For Google: also mark all individual Google plugin IDs as connected
  if (GOOGLE_PLUGIN_IDS.has(stateRow.plugin_id)) {
    for (const gPluginId of GOOGLE_PLUGIN_IDS) {
      upsertCredential.run(gPluginId, '{}', ...baseArgs)
    }
  }

  return NextResponse.redirect(
    new URL(`/oauth-success?plugin=${encodeURIComponent(stateRow.plugin_id)}`, req.url),
  )
}
