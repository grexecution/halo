/**
 * Daily journal — the "creepy long memory" feature.
 *
 * After every agent turn, we append a timestamped entry to
 *   ~/.open-greg/journal/YYYY-MM-DD.md
 *
 * Before each turn the orchestrator injects the last 3 days' entries into the
 * system prompt so the agent can naturally reference past conversations:
 *   "Last Tuesday you were debugging that auth issue…"
 *
 * Format:
 *   ## HH:MM
 *   **User:** <message>
 *   **Halo:** <reply>
 *
 * The journal files are plain Markdown — the user can read them, search them,
 * and Halo references them naturally.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const JOURNAL_DIR = join(homedir(), '.open-greg', 'journal')

function ensureDir(): void {
  if (!existsSync(JOURNAL_DIR)) {
    mkdirSync(JOURNAL_DIR, { recursive: true })
  }
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function timeKey(d: Date): string {
  return d.toISOString().slice(11, 16) // HH:MM (UTC) — fine for journal headings
}

/** Append a turn to today's journal file. Best-effort — never throws. */
export async function journalAppend(
  _agentId: string,
  userMessage: string,
  agentReply: string,
): Promise<void> {
  try {
    ensureDir()
    const now = new Date()
    const file = join(JOURNAL_DIR, `${dateKey(now)}.md`)
    const entry = `\n## ${timeKey(now)}\n**User:** ${userMessage.slice(0, 300)}\n**Halo:** ${agentReply.slice(0, 600)}\n`
    appendFileSync(file, entry, 'utf-8')
  } catch {
    // best-effort
  }
}

/** Read the last N days of journal entries for system prompt injection. */
export function readRecentJournal(days = 3): string {
  try {
    ensureDir()
    const entries: string[] = []
    const now = new Date()

    for (let i = 0; i < days; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = dateKey(d)
      const file = join(JOURNAL_DIR, `${key}.md`)
      if (!existsSync(file)) continue

      const content = readFileSync(file, 'utf-8').trim()
      if (!content) continue

      const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i} days ago (${key})`
      entries.push(`### ${label}\n${content}`)
    }

    return entries.join('\n\n')
  } catch {
    return ''
  }
}
