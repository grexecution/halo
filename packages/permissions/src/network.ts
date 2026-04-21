interface NetworkMiddlewareOptions {
  urlWhitelistMode: boolean
  allowedUrls: string[]
}

interface NetworkMiddleware {
  checkUrl(url: string): boolean
}

function urlMatchesPattern(url: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    // Convert wildcard to regex: escape special chars first, then convert * to .*
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    const regex = new RegExp(`^${escaped}`)
    return regex.test(url)
  }
  return url.startsWith(pattern)
}

export function createNetworkMiddleware(opts: NetworkMiddlewareOptions): NetworkMiddleware {
  return {
    checkUrl(url: string): boolean {
      if (!opts.urlWhitelistMode) return true
      return opts.allowedUrls.some((pattern) => urlMatchesPattern(url, pattern))
    },
  }
}
