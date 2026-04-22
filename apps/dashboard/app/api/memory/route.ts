import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { searchMemories, upsertMemory } from './store'
import type { MemoryEntry } from './store'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const source = searchParams.get('source') ?? undefined
  const type = searchParams.get('type') ?? undefined
  const limit = Number(searchParams.get('limit') ?? '20')
  const offset = Number(searchParams.get('offset') ?? '0')

  const opts: Parameters<typeof searchMemories>[0] = { query: q, limit, offset }
  if (source) opts.source = source
  if (type) opts.type = type

  return NextResponse.json(await searchMemories(opts))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<MemoryEntry>
  const now = new Date().toISOString()
  const entry: MemoryEntry = {
    id: body.id ?? `mem-${Date.now()}`,
    content: body.content ?? '',
    source: body.source ?? 'manual',
    sourceId: body.sourceId,
    type: body.type ?? 'note',
    tags: body.tags ?? [],
    metadata: body.metadata ?? {},
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  }
  await upsertMemory(entry)
  return NextResponse.json({ entry }, { status: 201 })
}
