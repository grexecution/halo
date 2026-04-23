import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCron, updateCron, deleteCron } from '../store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const job = getCron(id)
    if (!job) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      name?: string
      schedule?: string
      active?: boolean
      goal?: string
      command?: string
    }
    const job = updateCron(id, body)
    if (!job) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    return NextResponse.json(job)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!deleteCron(id)) return NextResponse.json({ error: 'Cron job not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
