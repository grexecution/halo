'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CardGridSkeleton } from '../components/ui/skeleton'

interface KnowledgeDoc {
  id: string
  title: string
  sourceType: 'upload' | 'url' | 'paste'
  sourceUrl: string | null
  content: string
  chunkCount: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  workspaceId: string | null
  tags: string[]
  createdAt: string
}

const SOURCE_ICONS: Record<string, string> = {
  upload: '📄',
  url: '🌐',
  paste: '📋',
}

type AddMode = 'paste' | 'url' | null

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch('/api/knowledge')
      .then((r) => r.json())
      .then((d: { docs?: KnowledgeDoc[] }) => setDocs(d.docs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave() {
    setSaving(true)
    try {
      const body =
        addMode === 'url'
          ? {
              title: title || url,
              sourceType: 'url',
              sourceUrl: url,
              content: '',
              tags: tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            }
          : {
              title: title || 'Untitled',
              sourceType: 'paste',
              content,
              tags: tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            }

      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setAddMode(null)
        setTitle('')
        setContent('')
        setUrl('')
        setTags('')
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ''),
          sourceType: 'upload',
          content: text,
          tags: [],
        }),
      })
      if (res.ok) load()
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function deleteDoc(id: string) {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const filtered = search
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : docs

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Documents, notes, and web pages that agents can recall
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 rounded-md transition-colors"
          >
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => setAddMode('url')}
            className="text-xs border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 rounded-md transition-colors"
          >
            Add URL
          </button>
          <button
            onClick={() => setAddMode('paste')}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md transition-colors"
          >
            + Add text
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or tag…"
        className="w-full mb-4 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
      />

      {/* Add form */}
      {addMode && (
        <div className="mb-5 bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              {addMode === 'url' ? 'Add URL' : 'Paste text'}
            </h3>
            <button
              onClick={() => setAddMode(null)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          {addMode === 'url' ? (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your text here…"
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
            />
          )}
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || (!content && !url)}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Docs list */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-3">
          <span className="text-4xl">📚</span>
          <p className="text-sm">
            {search
              ? 'No documents match your search'
              : 'No documents yet — add text, a URL, or upload a file'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-3"
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{SOURCE_ICONS[doc.sourceType]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{doc.title}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">
                    {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}
                  </span>
                  {doc.tags.length > 0 &&
                    doc.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                </div>
                {doc.content && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {doc.content.slice(0, 120)}
                  </p>
                )}
                {doc.sourceUrl && (
                  <a
                    href={doc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 truncate block mt-0.5"
                  >
                    {doc.sourceUrl}
                  </a>
                )}
                <p className="text-xs text-gray-700 mt-1">
                  {new Date(doc.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => deleteDoc(doc.id)}
                className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0 mt-0.5 transition-colors"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
