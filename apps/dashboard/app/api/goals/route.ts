import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listGoals, createGoal } from './store'

export async function GET() {
  try {
    return NextResponse.json({ goals: listGoals() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { title: string; description?: string; priority?: number }
    const goal = createGoal(body)
    return NextResponse.json(goal, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
