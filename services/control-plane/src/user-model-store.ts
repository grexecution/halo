/**
 * user-model-store.ts — persistent UserModel singleton.
 *
 * Wraps the UserModel from @open-greg/memory and persists its state to
 *   ~/.open-greg/user-model.json
 * on every update. Loaded once at startup, re-used across all turns.
 *
 * Correction detection:
 *   We look for explicit correction signals in the user's message:
 *     "no, ...", "actually ...", "don't ...", "stop ...", "I said ...",
 *     "wrong", "not like that", "I prefer ...", "I want you to ..."
 *   When we see one, we extract the instruction and apply it to the model.
 *
 * The model's buildPromptBlock() output is injected into every system prompt
 * so the agent remembers preferences across sessions without them needing to
 * be re-stated.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { UserModel } from '@open-greg/memory'
import type { UserModelState } from '@open-greg/memory'

const DIR = join(homedir(), '.open-greg')
const STATE_PATH = join(DIR, 'user-model.json')

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

function loadState(): UserModelState | null {
  try {
    if (!existsSync(STATE_PATH)) return null
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as UserModelState
  } catch {
    return null
  }
}

function saveState(model: UserModel): void {
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
    writeFileSync(STATE_PATH, JSON.stringify(model.export(), null, 2), { mode: 0o600 })
  } catch {
    // best-effort
  }
}

const _model = new UserModel()
const initial = loadState()
if (initial) _model.import(initial)

/** The global UserModel instance. Import this wherever you need preferences. */
export const userModelStore = _model

// ---------------------------------------------------------------------------
// Correction detection
// ---------------------------------------------------------------------------

// Patterns that signal the user is correcting or teaching the agent
const CORRECTION_PATTERNS: Array<{ re: RegExp; key: (m: RegExpMatchArray) => string }> = [
  {
    re: /\b(?:no[,.]?\s+(?:actually|please|don't|do not)|actually[,]\s+(?:please|don't|do not))/i,
    key: () => 'general',
  },
  { re: /\bi prefer\s+(.+)/i, key: (m) => `preference:${m[1]!.slice(0, 40)}` },
  { re: /\bi want you to\s+(.+)/i, key: (m) => `instruction:${m[1]!.slice(0, 40)}` },
  { re: /\bdon't\s+(.+)/i, key: (m) => `avoid:${m[1]!.slice(0, 40)}` },
  { re: /\bstop\s+(.+)/i, key: (m) => `stop:${m[1]!.slice(0, 40)}` },
  { re: /\bnot like that\b/i, key: () => 'style:general' },
  { re: /\bwrong[.,!]\s*(.+)/i, key: (m) => `wrong:${(m[1] ?? '').slice(0, 40)}` },
  { re: /\bi(?:'ve)? told you\b/i, key: () => 'recurring-mistake' },
  { re: /\bplease (?:always|never)\s+(.+)/i, key: (m) => `always:${m[1]!.slice(0, 40)}` },
]

/**
 * Inspect a user message for correction signals. If found, apply to UserModel
 * and persist the updated state. Best-effort — never throws.
 */
export async function detectCorrection(userMessage: string, _agentReply: string): Promise<void> {
  try {
    const msg = userMessage.trim()
    if (msg.length < 5) return

    for (const { re, key } of CORRECTION_PATTERNS) {
      const match = msg.match(re)
      if (!match) continue

      const instruction = msg.slice(0, 200)
      const k = key(match)

      _model.applyCorrection({
        key: k,
        instruction,
        source: 'explicit',
      })

      // Also record as a potential drift pattern if it's the second+ time
      const pref = _model.getPreference(k)
      if (pref && pref.correctionCount >= 2) {
        _model.recordMistake(k, instruction)
      }

      saveState(_model)
      break // one correction per message is enough
    }
  } catch {
    // best-effort
  }
}
