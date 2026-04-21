'use client'
import { useState } from 'react'

interface RegistryItem {
  id: string
  name: string
  category: 'mcp' | 'llm' | 'npm' | 'python'
  status: 'active' | 'inactive'
  lastUsed?: string | undefined
}

export default function RegistryPage() {
  const [items] = useState<RegistryItem[]>([
    {
      id: 'claude',
      name: 'Claude (Anthropic)',
      category: 'llm',
      status: 'active',
      lastUsed: new Date().toISOString(),
    },
    { id: 'ollama', name: 'Ollama (local)', category: 'llm', status: 'inactive' },
    { id: 'gmail-mcp', name: 'Gmail MCP', category: 'mcp', status: 'inactive' },
    { id: 'github-mcp', name: 'GitHub MCP', category: 'mcp', status: 'inactive' },
  ])

  const categories: RegistryItem['category'][] = ['mcp', 'llm', 'npm', 'python']

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Registry</h1>
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat)
        if (catItems.length === 0) return null
        return (
          <section key={cat} className="mb-6" data-testid={`registry-category-${cat}`}>
            <h2 className="text-lg font-semibold mb-2 capitalize">
              {cat === 'llm' ? 'LLM Providers' : cat.toUpperCase() + ' packages'}
            </h2>
            <ul className="space-y-1">
              {catItems.map((item) => (
                <li
                  key={item.id}
                  data-testid={`registry-item-${item.id}`}
                  className="border rounded p-2 flex justify-between items-center"
                >
                  <span>{item.name}</span>
                  <div className="flex items-center gap-3">
                    {item.lastUsed && (
                      <span className="text-xs text-gray-400">Last: {item.lastUsed}</span>
                    )}
                    <span
                      className={`text-xs font-semibold ${item.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </main>
  )
}
