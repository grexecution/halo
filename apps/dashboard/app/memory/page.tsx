'use client'
import { useState } from 'react'

interface MemoryItem {
  id: string
  content: string
  source: string
  timestamp: string
}

export default function MemoryPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemoryItem[]>([])
  const [isSearching, setIsSearching] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`)
      const data = (await res.json()) as { results: MemoryItem[] }
      setResults(data.results)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/memory/${id}`, { method: 'DELETE' })
    setResults((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Memory Browser</h1>
      <div className="flex gap-2 mb-4">
        <input
          data-testid="memory-search-input"
          className="flex-1 border rounded px-3 py-2"
          placeholder="Search memories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          data-testid="memory-search-button"
          onClick={handleSearch}
          disabled={isSearching}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {isSearching && <div data-testid="searching-indicator">Searching…</div>}

      <ul data-testid="memory-results" className="space-y-2">
        {results.map((item) => (
          <li key={item.id} data-testid={`memory-item-${item.id}`} className="border rounded p-3">
            <p className="text-sm">{item.content}</p>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{item.source}</span>
              <span>{item.timestamp}</span>
              <button
                data-testid={`delete-memory-${item.id}`}
                onClick={() => handleDelete(item.id)}
                className="text-red-400"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {results.length === 0 && !isSearching && query && (
          <li data-testid="no-results" className="text-gray-400">
            No memories found
          </li>
        )}
      </ul>
    </main>
  )
}
