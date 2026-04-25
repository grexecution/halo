/**
 * Memory import pipeline
 *
 * Accepts uploaded files and normalises them to MemoryEntry format.
 * Supports:
 *   - OpenAI ChatGPT  conversations.json
 *   - Anthropic Claude conversations.json
 *   - Generic JSON    [{content, source?, type?, created_at?}]
 *   - Generic CSV     content,source,type,created_at
 *   - WhatsApp .txt   exported chat file
 *   - Telegram JSON   result.json from tg-data export
 */

import { randomUUID } from 'node:crypto'
import type { MemoryEntry } from './memory-pipeline.js'

// ---------------------------------------------------------------------------
// OpenAI export format
// ---------------------------------------------------------------------------

interface OpenAIExport {
  title?: string
  create_time?: number
  mapping?: Record<
    string,
    {
      message?: {
        author?: { role?: string }
        content?: { content_type?: string; parts?: unknown[] }
        create_time?: number | null
      }
    }
  >
}

function parseOpenAI(raw: unknown): MemoryEntry[] {
  const entries: MemoryEntry[] = []
  const convs = Array.isArray(raw) ? (raw as OpenAIExport[]) : [raw as OpenAIExport]

  for (const conv of convs) {
    if (!conv.mapping) continue
    const title = conv.title ?? 'ChatGPT conversation'

    for (const node of Object.values(conv.mapping)) {
      const msg = node.message
      if (!msg) continue
      const role = msg.author?.role
      if (role !== 'user' && role !== 'assistant') continue
      const parts = msg.content?.parts ?? []
      const text = parts
        .map((p) => (typeof p === 'string' ? p : ''))
        .join('\n')
        .trim()
      if (!text) continue

      const ts = msg.create_time
        ? new Date(msg.create_time * 1000).toISOString()
        : new Date().toISOString()

      entries.push({
        id: randomUUID(),
        content: `[${title}] ${role === 'user' ? 'User' : 'Assistant'}: ${text}`,
        source: 'chatgpt',
        type: 'chat',
        tags: ['chatgpt', 'import', role],
        metadata: { title, role },
        createdAt: ts,
        updatedAt: ts,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// Anthropic / Claude export format
// ---------------------------------------------------------------------------

interface ClaudeExport {
  uuid?: string
  name?: string
  created_at?: string
  chat_messages?: Array<{
    uuid?: string
    sender?: string
    text?: string
    created_at?: string
  }>
}

function parseClaude(raw: unknown): MemoryEntry[] {
  const entries: MemoryEntry[] = []
  const convs = Array.isArray(raw) ? (raw as ClaudeExport[]) : [raw as ClaudeExport]

  for (const conv of convs) {
    const title = conv.name ?? 'Claude conversation'
    for (const msg of conv.chat_messages ?? []) {
      const text = msg.text?.trim()
      if (!text) continue
      const role = msg.sender ?? 'unknown'
      const ts = msg.created_at ?? conv.created_at ?? new Date().toISOString()

      entries.push({
        id: msg.uuid ?? randomUUID(),
        content: `[${title}] ${role === 'human' ? 'User' : 'Assistant'}: ${text}`,
        source: 'claude',
        type: 'chat',
        tags: ['claude', 'import', role === 'human' ? 'user' : 'assistant'],
        metadata: { title, role },
        createdAt: ts,
        updatedAt: ts,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// Telegram JSON export (result.json from official export)
// ---------------------------------------------------------------------------

interface TelegramExport {
  name?: string
  messages?: Array<{
    id?: number
    type?: string
    date?: string
    from?: string
    text?: unknown
  }>
}

function parseTelegram(raw: unknown): MemoryEntry[] {
  const entries: MemoryEntry[] = []
  const data = raw as TelegramExport
  const chatName = data.name ?? 'Telegram'

  for (const msg of data.messages ?? []) {
    if (msg.type !== 'message') continue
    const text =
      typeof msg.text === 'string'
        ? msg.text
        : Array.isArray(msg.text)
          ? msg.text
              .map((t: unknown) =>
                typeof t === 'string' ? t : ((t as Record<string, string>).text ?? ''),
              )
              .join('')
          : ''
    if (!text.trim()) continue

    const ts = msg.date ? new Date(msg.date).toISOString() : new Date().toISOString()
    entries.push({
      id: randomUUID(),
      content: `[${chatName}] ${msg.from ?? 'Unknown'}: ${text.trim()}`,
      source: 'telegram',
      sourceId: msg.id != null ? String(msg.id) : undefined,
      type: 'message',
      tags: ['telegram', 'import'],
      metadata: { chat: chatName, from: msg.from },
      createdAt: ts,
      updatedAt: ts,
    })
  }
  return entries
}

// ---------------------------------------------------------------------------
// WhatsApp .txt export
// ---------------------------------------------------------------------------

// Format: "12/31/23, 10:05 AM - Name: message text"
const WA_LINE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?:\s?[AP]M)?)\s+-\s+([^:]+):\s+(.+)$/

function parseWhatsApp(text: string): MemoryEntry[] {
  const entries: MemoryEntry[] = []
  const lines = text.split('\n')
  let current: { sender: string; ts: string; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const content = current.lines.join(' ').trim()
    if (!content || content === '<Media omitted>') return
    entries.push({
      id: randomUUID(),
      content: `[WhatsApp] ${current.sender}: ${content}`,
      source: 'whatsapp',
      type: 'message',
      tags: ['whatsapp', 'import'],
      metadata: { sender: current.sender },
      createdAt: current.ts,
      updatedAt: current.ts,
    })
    current = null
  }

  for (const line of lines) {
    const match = WA_LINE.exec(line)
    if (match) {
      flush()
      const [, date, time, sender, msg] = match
      let ts: string
      try {
        ts = new Date(`${date} ${time}`).toISOString()
      } catch {
        ts = new Date().toISOString()
      }
      current = { sender: sender!.trim(), ts, lines: [msg!] }
    } else if (current && line.trim()) {
      current.lines.push(line.trim())
    }
  }
  flush()
  return entries
}

// ---------------------------------------------------------------------------
// Generic JSON array
// ---------------------------------------------------------------------------

interface GenericRow {
  content?: string
  text?: string
  body?: string
  message?: string
  source?: string
  type?: string
  created_at?: string
  date?: string
  timestamp?: string
  tags?: string[] | string
  metadata?: Record<string, unknown>
}

function parseGenericJson(raw: unknown): MemoryEntry[] {
  const rows = Array.isArray(raw) ? (raw as GenericRow[]) : [raw as GenericRow]
  return rows.flatMap((r) => {
    const content = (r.content ?? r.text ?? r.body ?? r.message ?? '').trim()
    if (!content) return []
    const ts = r.created_at ?? r.date ?? r.timestamp ?? new Date().toISOString()
    const safets = (() => {
      try {
        return new Date(ts).toISOString()
      } catch {
        return new Date().toISOString()
      }
    })()
    const tags = Array.isArray(r.tags)
      ? r.tags
      : typeof r.tags === 'string'
        ? r.tags.split(',').map((t) => t.trim())
        : ['import']

    return [
      {
        id: randomUUID(),
        content,
        source: r.source ?? 'import',
        type: r.type ?? 'note',
        tags: [...new Set([...tags, 'import'])],
        metadata: r.metadata ?? {},
        createdAt: safets,
        updatedAt: safets,
      } satisfies MemoryEntry,
    ]
  })
}

// ---------------------------------------------------------------------------
// Generic CSV
// ---------------------------------------------------------------------------

function parseCsv(text: string): MemoryEntry[] {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
  const entries: MemoryEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.match(/("(?:[^"]|"")*"|[^,]*)/g) ?? []
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()
    })

    const content = (row['content'] ?? row['text'] ?? row['body'] ?? '').trim()
    if (!content) continue

    const ts = (() => {
      try {
        return new Date(row['created_at'] ?? row['date'] ?? '').toISOString()
      } catch {
        return new Date().toISOString()
      }
    })()

    entries.push({
      id: randomUUID(),
      content,
      source: row['source'] ?? 'csv',
      type: row['type'] ?? 'note',
      tags: row['tags'] ? row['tags'].split(';').map((t) => t.trim()) : ['import'],
      metadata: {},
      createdAt: ts,
      updatedAt: ts,
    })
  }
  return entries
}

// ---------------------------------------------------------------------------
// Main parse dispatcher
// ---------------------------------------------------------------------------

export type ImportFormat = 'chatgpt' | 'claude' | 'telegram' | 'whatsapp' | 'json' | 'csv' | 'auto'

export function parseImportFile(
  content: string,
  format: ImportFormat = 'auto',
): { entries: MemoryEntry[]; format: string; error?: string } {
  try {
    if (format === 'csv' || (format === 'auto' && !content.trimStart().startsWith('['))) {
      // Try CSV if not JSON
      if (!content.trimStart().startsWith('{') && !content.trimStart().startsWith('[')) {
        // Check if it looks like WhatsApp
        if (WA_LINE.test(content.split('\n').find((l) => l.trim()) ?? '')) {
          return { entries: parseWhatsApp(content), format: 'whatsapp' }
        }
        return { entries: parseCsv(content), format: 'csv' }
      }
    }

    if (format === 'whatsapp') {
      return { entries: parseWhatsApp(content), format: 'whatsapp' }
    }

    if (format === 'csv') {
      return { entries: parseCsv(content), format: 'csv' }
    }

    // JSON formats
    const raw: unknown = JSON.parse(content)

    if (format === 'chatgpt') return { entries: parseOpenAI(raw), format: 'chatgpt' }
    if (format === 'claude') return { entries: parseClaude(raw), format: 'claude' }
    if (format === 'telegram') return { entries: parseTelegram(raw), format: 'telegram' }
    if (format === 'json') return { entries: parseGenericJson(raw), format: 'json' }

    // Auto-detect JSON format
    if (Array.isArray(raw)) {
      const first = raw[0] as Record<string, unknown>
      if (first?.mapping !== undefined || first?.create_time !== undefined) {
        return { entries: parseOpenAI(raw), format: 'chatgpt' }
      }
      if (first?.chat_messages !== undefined) {
        return { entries: parseClaude(raw), format: 'claude' }
      }
      if (first?.messages !== undefined && first?.type === undefined) {
        return { entries: parseTelegram(raw), format: 'telegram' }
      }
      return { entries: parseGenericJson(raw), format: 'json' }
    }

    // Single object
    const obj = raw as Record<string, unknown>
    if (obj['mapping'] !== undefined) return { entries: parseOpenAI(raw), format: 'chatgpt' }
    if (obj['chat_messages'] !== undefined) return { entries: parseClaude(raw), format: 'claude' }
    if (obj['messages'] !== undefined) return { entries: parseTelegram(raw), format: 'telegram' }

    return { entries: parseGenericJson(raw), format: 'json' }
  } catch (err) {
    // Last resort: try WhatsApp plain text
    try {
      if (WA_LINE.test(content.split('\n').find((l) => l.trim()) ?? '')) {
        return { entries: parseWhatsApp(content), format: 'whatsapp' }
      }
    } catch {
      // ignore
    }
    return { entries: [], format: 'unknown', error: String(err) }
  }
}
