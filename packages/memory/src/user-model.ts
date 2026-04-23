/**
 * F-204: User preference modeling
 * F-205: Drift detection
 *
 * UserModel tracks:
 *   - Preferences: extracted from user correction signals ("no, not like that")
 *   - Mistakes: patterns the agent keeps repeating after being corrected
 *   - Drift: mistakes that recur above a threshold = the agent is "drifting"
 *
 * Stored purely in-memory with export/import for Postgres persistence.
 * The control-plane hydrates a UserModel per user on session start and
 * persists the exported state at session end.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CorrectionSource = 'explicit' | 'inferred'

export interface UserPreference {
  key: string
  instruction: string
  source: CorrectionSource
  correctionCount: number
  updatedAt: string
}

export interface UserMistake {
  pattern: string
  description: string
  recurrenceCount: number
  lastSeenAt: string
}

export interface UserModelState {
  preferences: UserPreference[]
  mistakes: UserMistake[]
}

export interface DriftDetectOptions {
  minRecurrences?: number
}

export interface BuildPromptBlockOptions {
  includeDrift?: boolean
  driftThreshold?: number
}

// ---------------------------------------------------------------------------
// UserModel
// ---------------------------------------------------------------------------

export class UserModel {
  private preferences: Map<string, UserPreference> = new Map()
  private mistakes: Map<string, UserMistake> = new Map()

  // ---------------------------------------------------------------------------
  // Preference tracking
  // ---------------------------------------------------------------------------

  applyCorrection(input: {
    key: string
    instruction: string
    source: CorrectionSource
  }): UserPreference {
    const existing = this.preferences.get(input.key)
    const pref: UserPreference = {
      key: input.key,
      instruction: input.instruction,
      source: input.source,
      correctionCount: (existing?.correctionCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }
    this.preferences.set(input.key, pref)
    return pref
  }

  getPreferences(): UserPreference[] {
    return Array.from(this.preferences.values())
  }

  getPreference(key: string): UserPreference | undefined {
    return this.preferences.get(key)
  }

  // ---------------------------------------------------------------------------
  // Drift / mistake tracking
  // ---------------------------------------------------------------------------

  recordMistake(pattern: string, description: string): UserMistake {
    const existing = this.mistakes.get(pattern)
    const mistake: UserMistake = {
      pattern,
      description,
      recurrenceCount: (existing?.recurrenceCount ?? 0) + 1,
      lastSeenAt: new Date().toISOString(),
    }
    this.mistakes.set(pattern, mistake)
    return mistake
  }

  getMistakes(): UserMistake[] {
    return Array.from(this.mistakes.values())
  }

  detectDrift(opts: DriftDetectOptions = {}): UserMistake[] {
    const threshold = opts.minRecurrences ?? 3
    return Array.from(this.mistakes.values()).filter((m) => m.recurrenceCount >= threshold)
  }

  // ---------------------------------------------------------------------------
  // Prompt block generation
  // ---------------------------------------------------------------------------

  buildPromptBlock(opts: BuildPromptBlockOptions = {}): string {
    const prefs = this.getPreferences()
    const includeDrift = opts.includeDrift ?? false
    const driftThreshold = opts.driftThreshold ?? 3

    if (prefs.length === 0 && !includeDrift) return ''

    const lines: string[] = []

    if (prefs.length > 0) {
      lines.push('## User preferences')
      lines.push('')
      for (const p of prefs) {
        lines.push(`- **${p.key}**: ${p.instruction}`)
      }
    }

    if (includeDrift) {
      const drifts = this.detectDrift({ minRecurrences: driftThreshold })
      if (drifts.length > 0) {
        if (lines.length > 0) lines.push('')
        lines.push('## Recurring mistakes to avoid')
        lines.push('')
        for (const d of drifts) {
          lines.push(`- **${d.pattern}** (repeated ${d.recurrenceCount}x): ${d.description}`)
        }
      }
    }

    return lines.join('\n').trimEnd() || ''
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  export(): UserModelState {
    return {
      preferences: Array.from(this.preferences.values()),
      mistakes: Array.from(this.mistakes.values()),
    }
  }

  import(state: UserModelState): void {
    this.preferences = new Map(state.preferences.map((p) => [p.key, p]))
    this.mistakes = new Map(state.mistakes.map((m) => [m.pattern, m]))
  }
}
