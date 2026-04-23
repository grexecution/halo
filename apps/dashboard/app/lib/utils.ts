import { randomUUID } from 'node:crypto'

/** Generate a collision-safe prefixed ID. Replaces `${prefix}-${Date.now()}` patterns. */
export function generateId(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}
