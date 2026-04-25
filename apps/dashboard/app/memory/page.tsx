'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Brain, Trash2, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { Button, Badge, Input, Select, Card, CardContent, EmptyState } from '../components/ui/index'
import { TableSkeleton, StatBannerSkeleton } from '../components/ui/skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemoryType = 'fact' | 'email' | 'document' | 'code' | 'note'

interface MemoryItem {
  id: string
  content: string
  source: string
  type: MemoryType
  timestamp?: string
  createdAt?: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}

interface MemoryStats {
  bySource: Record<string, number>
}

interface MemoryResponse {
  results: MemoryItem[]
  total: number
  stats: MemoryStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function typeVariant(type: MemoryType): 'default' | 'success' | 'info' | 'warning' | 'muted' {
  switch (type) {
    case 'fact':
      return 'default'
    case 'email':
      return 'info'
    case 'document':
      return 'success'
    case 'code':
      return 'warning'
    case 'note':
      return 'muted'
  }
}

// ─── Memory Item Card ─────────────────────────────────────────────────────────

interface MemoryCardProps {
  item: MemoryItem
  onDelete: (id: string) => void
}

function MemoryCard({ item, onDelete }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Delete this memory?')) return
    onDelete(item.id)
  }

  return (
    <Card data-testid={`memory-item-${item.id}`} className="relative">
      <CardContent className="py-3">
        {/* Top row: badges + delete */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="muted">{item.source}</Badge>
            <Badge variant={typeVariant(item.type)}>{item.type}</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            data-testid={`delete-memory-${item.id}`}
            onClick={handleDelete}
            className="shrink-0 text-red-500 hover:text-red-400 hover:bg-red-900/20"
            title="Delete memory"
          >
            <Trash2 size={13} />
          </Button>
        </div>

        {/* Content */}
        <p
          className={
            'text-sm text-gray-300 leading-relaxed whitespace-pre-wrap ' +
            (!expanded ? 'line-clamp-3' : '')
          }
        >
          {item.content}
        </p>

        {/* Expand/collapse */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-600">
            {fmtDate(item.createdAt ?? item.updatedAt ?? item.timestamp ?? '')}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp size={12} />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                Expand
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 min-w-[110px]">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const MEMORY_TYPES: MemoryType[] = ['fact', 'email', 'document', 'code', 'note']

export default function MemoryPage() {
  const [results, setResults] = useState<MemoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<MemoryStats>({ bySource: {} })
  const [isSearching, setIsSearching] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [offset, setOffset] = useState(0)

  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchMemories = useCallback(
    async (q: string, source: string, type: string, newOffset: number, append: boolean) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setIsSearching(true)
      try {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (source) params.set('source', source)
        if (type) params.set('type', type)
        params.set('limit', String(PAGE_SIZE))
        params.set('offset', String(newOffset))

        const res = await fetch(`/api/memory?${params.toString()}`, { signal: ctrl.signal })
        if (!res.ok) return
        const data = (await res.json()) as MemoryResponse
        setResults((prev) => (append ? [...prev, ...data.results] : data.results))
        setTotal(data.total)
        setStats(data.stats)
        setOffset(newOffset + data.results.length)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
      } finally {
        setIsSearching(false)
      }
    },
    [],
  )

  // Initial load
  useEffect(() => {
    void fetchMemories('', '', '', 0, false).then(() => setInitialLoadDone(true))
  }, [fetchMemories])

  // Debounced refetch when filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      void fetchMemories(query, sourceFilter, typeFilter, 0, false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, sourceFilter, typeFilter, fetchMemories])

  function clearFilters() {
    setQuery('')
    setSourceFilter('')
    setTypeFilter('')
  }

  function handleDelete(id: string) {
    setResults((prev) => prev.filter((m) => m.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    void fetch(`/api/memory/${id}`, { method: 'DELETE' })
  }

  function loadMore() {
    void fetchMemories(query, sourceFilter, typeFilter, offset, true)
  }

  const hasMore = results.length < total
  const isFiltering = query !== '' || sourceFilter !== '' || typeFilter !== ''

  // Top sources for stat cards (top 3)
  const topSources = Object.entries(stats.bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const allSources = Object.keys(stats.bySource).sort()

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-4">Memory</h1>

        {/* Stat cards */}
        {!initialLoadDone ? (
          <div className="flex gap-3">
            <StatBannerSkeleton count={3} />
          </div>
        ) : null}
        <div className="flex items-center gap-3 flex-wrap">
          {initialLoadDone && <StatCard label="Total memories" value={total} />}
          {topSources.map(([source, count]) => (
            <StatCard key={source} label={source} value={count} />
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
          />
          <Input
            data-testid="memory-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories..."
            className="pl-8"
          />
        </div>

        <Select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All Sources</option>
          {allSources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
          <option value="">All Types</option>
          {MEMORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>

        {isFiltering && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
            <X size={13} />
            Clear
          </Button>
        )}

        <Button
          data-testid="memory-search-button"
          variant="outline"
          size="sm"
          onClick={() => {
            setOffset(0)
            void fetchMemories(query, sourceFilter, typeFilter, 0, false)
          }}
          className="shrink-0"
        >
          Search
        </Button>
      </div>

      {/* Results */}
      {isSearching && !initialLoadDone ? (
        <TableSkeleton rows={5} cols={4} />
      ) : isSearching ? (
        <p data-testid="searching-indicator" className="text-xs text-gray-600 animate-pulse">
          Searching…
        </p>
      ) : results.length === 0 ? (
        <div data-testid="no-results">
          <EmptyState
            icon={<Brain size={36} />}
            title="No memories found"
            description={
              isFiltering
                ? 'No memories match your current filters. Try adjusting or clearing them.'
                : 'No memories have been stored yet.'
            }
          />
        </div>
      ) : (
        <div data-testid="memory-results" className="space-y-2">
          {results.map((item) => (
            <MemoryCard key={item.id} item={item} onDelete={handleDelete} />
          ))}

          {hasMore && !isSearching && (
            <div className="pt-2 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
