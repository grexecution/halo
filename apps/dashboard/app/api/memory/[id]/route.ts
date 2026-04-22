import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { deleteMemory } from '../store'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteMemory(id)
  return NextResponse.json({ ok: true })
}
