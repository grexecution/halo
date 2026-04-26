/**
 * OAuth2 provider configurations for each connector plugin.
 * Used by the dashboard's /api/oauth/start and /api/oauth/callback routes.
 */

export interface OAuthProviderConfig {
  authUrl: string
  tokenUrl: string
  /** Scopes to request — can be overridden per-request */
  defaultScopes: string[]
  /** Whether to use PKCE (code_challenge / code_verifier) */
  pkce: boolean
  /** Whether the provider returns a refresh_token */
  supportsRefresh: boolean
  /** Some providers need client_secret in the token exchange body */
  clientSecretInBody: boolean
}

export const OAUTH_PROVIDER_CONFIGS: Record<string, OAuthProviderConfig> = {
  // ── Google Workspace (single login, multiple products) ──────────────────────
  'google-workspace': {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    defaultScopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    pkce: true,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── Linear ──────────────────────────────────────────────────────────────────
  linear: {
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    defaultScopes: ['read', 'write', 'issues:create', 'comments:create'],
    pkce: false,
    supportsRefresh: false,
    clientSecretInBody: true,
  },

  // ── Slack ───────────────────────────────────────────────────────────────────
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    defaultScopes: [
      'channels:read',
      'chat:write',
      'files:read',
      'files:write',
      'users:read',
      'channels:history',
    ],
    pkce: false,
    supportsRefresh: false,
    clientSecretInBody: true,
  },

  // ── Dropbox ─────────────────────────────────────────────────────────────────
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    defaultScopes: ['files.content.read', 'files.content.write', 'account_info.read'],
    pkce: true,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── Microsoft (Outlook, OneDrive, Teams) ────────────────────────────────────
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    defaultScopes: [
      'openid',
      'email',
      'profile',
      'offline_access',
      'Mail.ReadWrite',
      'Calendars.ReadWrite',
      'Files.ReadWrite',
    ],
    pkce: true,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── GitHub ──────────────────────────────────────────────────────────────────
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    defaultScopes: ['repo', 'read:user', 'read:org'],
    pkce: false,
    supportsRefresh: false,
    clientSecretInBody: true,
  },

  // ── Asana ───────────────────────────────────────────────────────────────────
  asana: {
    authUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    defaultScopes: ['default'],
    pkce: false,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── Salesforce ──────────────────────────────────────────────────────────────
  salesforce: {
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    defaultScopes: ['api', 'refresh_token', 'offline_access'],
    pkce: false,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── HubSpot ─────────────────────────────────────────────────────────────────
  hubspot: {
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    defaultScopes: ['contacts', 'crm.objects.contacts.read', 'crm.objects.deals.read'],
    pkce: false,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── QuickBooks ──────────────────────────────────────────────────────────────
  quickbooks: {
    authUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    defaultScopes: ['com.intuit.quickbooks.accounting'],
    pkce: false,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── Xero ────────────────────────────────────────────────────────────────────
  xero: {
    authUrl: 'https://login.xero.com/identity/connect/authorize',
    tokenUrl: 'https://identity.xero.com/connect/token',
    defaultScopes: ['openid', 'profile', 'email', 'accounting.transactions', 'offline_access'],
    pkce: true,
    supportsRefresh: true,
    clientSecretInBody: true,
  },

  // ── Box ─────────────────────────────────────────────────────────────────────
  box: {
    authUrl: 'https://account.box.com/api/oauth2/authorize',
    tokenUrl: 'https://api.box.com/oauth2/token',
    defaultScopes: [],
    pkce: false,
    supportsRefresh: true,
    clientSecretInBody: true,
  },
}

/** Maps plugin IDs to their OAuth provider key */
export const PLUGIN_TO_PROVIDER: Record<string, string> = {
  // All Google products share one login (plugin IDs use underscores)
  gmail: 'google-workspace',
  google_calendar: 'google-workspace',
  google_drive: 'google-workspace',
  google_docs: 'google-workspace',
  google_sheets: 'google-workspace',
  // Others
  linear: 'linear',
  slack: 'slack',
  dropbox: 'dropbox',
  microsoft_outlook: 'microsoft',
  microsoft_teams: 'microsoft',
  github: 'github',
  asana: 'asana',
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  quickbooks: 'quickbooks',
  xero: 'xero',
  box: 'box',
}

/** Google plugin IDs — all share one OAuth consent screen */
export const GOOGLE_PLUGIN_IDS = new Set([
  'gmail',
  'google_calendar',
  'google_drive',
  'google_docs',
  'google_sheets',
])

/**
 * Maps provider key → env var prefix for client_id/client_secret.
 * E.g. 'google-workspace' → 'GOOGLE' means we look for GOOGLE_CLIENT_ID.
 * Providers not listed here use toUpperCase().replace(/-/g, '_').
 */
export const PROVIDER_ENV_PREFIX: Record<string, string> = {
  'google-workspace': 'GOOGLE',
  microsoft: 'MICROSOFT',
  linear: 'LINEAR',
  slack: 'SLACK',
  dropbox: 'DROPBOX',
  github: 'GITHUB',
  asana: 'ASANA',
  salesforce: 'SALESFORCE',
  hubspot: 'HUBSPOT',
  quickbooks: 'QUICKBOOKS',
  xero: 'XERO',
  box: 'BOX',
}

export function getProviderConfig(pluginId: string): OAuthProviderConfig | null {
  const providerKey = PLUGIN_TO_PROVIDER[pluginId]
  if (!providerKey) return null
  return OAUTH_PROVIDER_CONFIGS[providerKey] ?? null
}
