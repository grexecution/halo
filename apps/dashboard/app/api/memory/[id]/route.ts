import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Memory storage is not yet connected — acknowledge deletion optimistically.
  await params
  return NextResponse.json({ ok: true })
}
