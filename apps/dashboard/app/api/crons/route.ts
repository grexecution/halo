export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listCrons, createCron } from './store'

export async function GET() {
  try {
    return NextResponse.json({ jobs: listCrons() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string
      schedule: string
      goal?: string
      command?: string
    }
    const job = createCron(body)
    return NextResponse.json(job, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
