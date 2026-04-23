import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Don't fail the build if the SW source doesn't exist yet in CI
  disable: process.env['NODE_ENV'] === 'test',
})

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

export default withSerwist(nextConfig)
