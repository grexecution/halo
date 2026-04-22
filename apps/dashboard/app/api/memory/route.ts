import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface MemoryItem {
  id: string
  content: string
  source: string
  type: string
  timestamp: string
  metadata?: Record<string, unknown>
}

interface MemoryResponse {
  results: MemoryItem[]
  total: number
  stats: { bySource: Record<string, number> }
}

export async function GET(_req: NextRequest): Promise<NextResponse<MemoryResponse>> {
  // Memory storage is not yet connected — return empty stub with pagination metadata.
  // Query params (q, source, limit, offset) are accepted but ignored for now.
  return NextResponse.json({
    results: [],
    total: 0,
    stats: { bySource: {} },
  })
}
