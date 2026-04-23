export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listAgents, upsertAgent } from './store'
import type { Agent } from './store'

export function GET() {
  return NextResponse.json({ agents: listAgents() })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Agent
  const agent = upsertAgent(body)
  return NextResponse.json({ agent })
}
