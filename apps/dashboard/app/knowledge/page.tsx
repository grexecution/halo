'use client'

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { CardGridSkeleton } from '../components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { EmptyState } from '@/app/components/ui/empty-state'
import { FileText, Globe, ClipboardList, BookOpen, Upload, Link, Plus, Trash2 } from 'lucide-react'

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

const SOURCE_ICONS: Record<string, ReactNode> = {
  upload: <FileText size={14} />,
  url: <Globe size={14} />,
  paste: <ClipboardList size={14} />,
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
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Upload file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button variant="outline" size="sm" onClick={() => setAddMode('url')}>
            <Link size={14} /> Add URL
          </Button>
          <Button onClick={() => setAddMode('paste')}>
            <Plus size={14} /> Add text
          </Button>
        </div>
      </div>

      {/* Search */}
      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or tag…"
        className="mb-4"
      />

      {/* Add form */}
      {addMode && (
        <div className="mb-5 bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              {addMode === 'url' ? 'Add URL' : 'Paste text'}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setAddMode(null)}>
              Cancel
            </Button>
          </div>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
          />
          {addMode === 'url' ? (
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your text here…"
              rows={6}
            />
          )}
          <Input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated)"
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || (!content && !url)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Docs list */}
      {loading ? (
        <CardGridSkeleton count={6} cols={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No documents yet"
          description={
            search ? 'No documents match your search' : 'Add text, a URL, or upload a file'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start gap-3"
            >
              <span className="text-gray-400 flex-shrink-0 mt-0.5">
                {SOURCE_ICONS[doc.sourceType]}
              </span>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDoc(doc.id)}
                title="Delete"
                className="flex-shrink-0 mt-0.5 text-gray-600 hover:text-red-400"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
