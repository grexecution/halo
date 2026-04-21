export type ConnectorStatus = 'active' | 'inactive' | 'error'

export interface ConnectorMeta {
  id: string
  name: string
  type: 'mcp' | 'oauth' | 'api-key'
  status: ConnectorStatus
  lastUsed?: string | undefined
  tools?: string[] | undefined
}

export interface McpRegistry {
  register(meta: ConnectorMeta): void
  unregister(id: string): void
  list(): ConnectorMeta[]
  get(id: string): ConnectorMeta | undefined
  isActive(id: string): boolean
}

export function createMcpRegistry(): McpRegistry {
  const registry = new Map<string, ConnectorMeta>()

  return {
    register(meta) {
      registry.set(meta.id, meta)
    },
    unregister(id) {
      registry.delete(id)
    },
    list() {
      return [...registry.values()]
    },
    get(id) {
      return registry.get(id)
    },
    isActive(id) {
      return registry.get(id)?.status === 'active'
    },
  }
}

export interface OAuthToken {
  connectorId: string
  accessToken: string
  refreshToken?: string | undefined
  expiresAt?: string | undefined
}

export interface OAuthConfig {
  connectorId: string
  clientId: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
  redirectUri: string
}

export interface OAuthFlow {
  getAuthUrl(state: string): string
  exchangeCode(code: string): Promise<OAuthToken>
}

export function createOAuthFlow(config: OAuthConfig): OAuthFlow {
  return {
    getAuthUrl(state: string): string {
      const params = new URLSearchParams({
        client_id: config.clientId,
        scope: config.scopes.join(' '),
        redirect_uri: config.redirectUri,
        response_type: 'code',
        state,
      })
      return `${config.authUrl}?${params}`
    },
    async exchangeCode(code: string): Promise<OAuthToken> {
      const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
        }),
      })
      if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
      const data = (await res.json()) as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }
      return {
        connectorId: config.connectorId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : undefined,
      }
    },
  }
}

export interface RateLimiter {
  attempt<T>(fn: () => Promise<T>): Promise<T>
  getBackoffMs(): number
}

export function createRateLimiter(
  opts: { maxRetries?: number | undefined; baseDelayMs?: number | undefined } = {},
): RateLimiter {
  const maxRetries = opts.maxRetries ?? 5
  const baseDelay = opts.baseDelayMs ?? 1000
  let consecutiveFailures = 0

  return {
    getBackoffMs(): number {
      return baseDelay * Math.pow(2, Math.min(consecutiveFailures, 8))
    },
    async attempt<T>(fn: () => Promise<T>): Promise<T> {
      let lastError: Error | undefined

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, Math.min(attempt - 1, 8))
          await new Promise((r) => setTimeout(r, delay))
        }
        try {
          const result = await fn()
          consecutiveFailures = 0
          return result
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          if (lastError.message.includes('429') || lastError.message.includes('rate limit')) {
            consecutiveFailures++
            continue
          }
          throw lastError
        }
      }
      consecutiveFailures++
      throw lastError ?? new Error('Max retries exceeded')
    },
  }
}
