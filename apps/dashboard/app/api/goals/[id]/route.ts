import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getGoal, updateGoal, deleteGoal } from '../store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const goal = getGoal(id)
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    return NextResponse.json(goal)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      title?: string
      description?: string
      priority?: number
      status?: 'pending' | 'running' | 'completed' | 'failed'
    }
    const goal = updateGoal(id, body)
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    return NextResponse.json(goal)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!deleteGoal(id)) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
