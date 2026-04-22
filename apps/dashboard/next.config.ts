import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@open-greg/connectors'],
  serverExternalPackages: [
    '@mastra/memory',
    '@mastra/libsql',
    '@mastra/fastembed',
    '@mastra/core',
    'fastembed',
    'better-sqlite3',
    '@ai-sdk/anthropic',
    '@ai-sdk/openai',
  ],
}

export default nextConfig
