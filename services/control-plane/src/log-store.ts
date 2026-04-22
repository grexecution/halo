/**
 * In-memory ring-buffer log store.
 *
 * Other modules call emitLog() to push structured entries.
 * Fastify's Pino logger also writes through via the custom stream below.
 * GET /api/logs reads back from here with optional filters.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
  agentId?: string
  toolId?: string
  /** Duration of the operation in ms */
  durationMs?: number
  /** Token count for LLM calls */
  tokenCount?: number
  /** Estimated cost in USD */
  costUsd?: number
  /** Arbitrary extra context */
  meta?: Record<string, unknown>
}

export type LogInput = Omit<LogEntry, 'id' | 'timestamp'> & { timestamp?: string }

const RING_SIZE = 500

let _seq = 0
const _ring: LogEntry[] = []

function nextId(): string {
  _seq += 1
  return String(_seq)
}

/** Push a structured log entry into the ring buffer. */
export function emitLog(input: LogInput): void {
  const record: LogEntry = {
    id: nextId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: input.level,
    message: input.message,
  }
  if (input.agentId !== undefined) record.agentId = input.agentId
  if (input.toolId !== undefined) record.toolId = input.toolId
  if (input.durationMs !== undefined) record.durationMs = input.durationMs
  if (input.tokenCount !== undefined) record.tokenCount = input.tokenCount
  if (input.costUsd !== undefined) record.costUsd = input.costUsd
  if (input.meta !== undefined) record.meta = input.meta

  _ring.push(record)
  if (_ring.length > RING_SIZE) _ring.shift()
}

export interface LogQuery {
  level?: string
  agentId?: string
  toolId?: string
  limit?: number
  since?: string // ISO timestamp — return entries after this time
}

/** Query the ring buffer. Returns newest-first. */
export function queryLogs(q: LogQuery = {}): LogEntry[] {
  const limit = Math.min(q.limit ?? 100, RING_SIZE)
  let results = _ring.slice()

  if (q.level) results = results.filter((e) => e.level === q.level)
  if (q.agentId) results = results.filter((e) => e.agentId === q.agentId)
  if (q.toolId) results = results.filter((e) => e.toolId === q.toolId)
  if (q.since) results = results.filter((e) => e.timestamp > q.since!)

  return results.slice(-limit).reverse()
}

/** Returns the list of unique agentIds seen so far (for filter dropdowns). */
export function knownAgents(): string[] {
  const seen = new Set<string>()
  for (const e of _ring) if (e.agentId) seen.add(e.agentId)
  return [...seen].sort()
}

/** Returns the list of unique toolIds seen so far. */
export function knownTools(): string[] {
  const seen = new Set<string>()
  for (const e of _ring) if (e.toolId) seen.add(e.toolId)
  return [...seen].sort()
}

/**
 * A Pino-compatible writable stream.
 * Pass this as the stream option to Pino and it will forward every log line into the ring buffer.
 */
export const pinoRingStream = {
  write(line: string): void {
    try {
      // Pino emits newline-delimited JSON
      const obj = JSON.parse(line.trim()) as {
        level?: number
        time?: number
        msg?: string
        agentId?: string
        toolId?: string
        durationMs?: number
        tokenCount?: number
        costUsd?: number
      }
      const pinoLevelToStr = (n: number): LogLevel => {
        if (n >= 50) return 'error'
        if (n >= 40) return 'warn'
        if (n >= 20) return 'debug'
        return 'info'
      }
      const input: LogInput = {
        level: pinoLevelToStr(obj.level ?? 30),
        message: obj.msg ?? line.trim(),
      }
      if (obj.time) input.timestamp = new Date(obj.time).toISOString()
      if (obj.agentId) input.agentId = obj.agentId
      if (obj.toolId) input.toolId = obj.toolId
      if (obj.durationMs !== undefined) input.durationMs = obj.durationMs
      if (obj.tokenCount !== undefined) input.tokenCount = obj.tokenCount
      if (obj.costUsd !== undefined) input.costUsd = obj.costUsd
      emitLog(input)
    } catch {
      emitLog({ level: 'info', message: line.trim() })
    }
  },
}
