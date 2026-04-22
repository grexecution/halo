/**
 * Sub-agent mention parsing.
 *
 * Parses "@handle task" syntax from chat messages so the orchestrator
 * can route tasks to specialized sub-agents.
 */

export interface MentionResult {
  handle: string
  task: string
}

export function parseMention(text: string): MentionResult | null {
  const match = text.match(/^@(\w+)\s+(.+)$/)
  if (!match) return null
  return {
    handle: match[1] ?? '',
    task: match[2]?.trim() ?? '',
  }
}
