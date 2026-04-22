import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@open-greg/connectors'],
  serverExternalPackages: ['@lancedb/lancedb', '@xenova/transformers', 'onnxruntime-node'],
}

export default nextConfig
