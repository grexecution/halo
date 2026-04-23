/**
 * F-204: User preference modeling
 * F-205: Drift detection
 *
 * UserModel tracks user preferences extracted from correction signals
 * and detects when the agent repeats a mistake the user already corrected.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { UserModel } from '../src/user-model.js'

describe('F-204: UserModel — preference tracking', () => {
  let model: UserModel

  beforeEach(() => {
    model = new UserModel()
  })

  it('records a preference from a correction signal', () => {
    model.applyCorrection({
      key: 'output-format',
      instruction: 'Always respond in bullet points, not paragraphs.',
      source: 'explicit',
    })

    const prefs = model.getPreferences()
    expect(prefs).toHaveLength(1)
    expect(prefs[0]!.key).toBe('output-format')
    expect(prefs[0]!.instruction).toContain('bullet points')
  })

  it('upserts a preference when the same key is corrected again', () => {
    model.applyCorrection({
      key: 'output-format',
      instruction: 'Use bullet points.',
      source: 'explicit',
    })
    model.applyCorrection({
      key: 'output-format',
      instruction: 'Use numbered lists.',
      source: 'explicit',
    })

    const prefs = model.getPreferences()
    expect(prefs).toHaveLength(1)
    expect(prefs[0]!.instruction).toBe('Use numbered lists.')
  })

  it('stores multiple distinct preferences', () => {
    model.applyCorrection({ key: 'tone', instruction: 'Be more concise.', source: 'explicit' })
    model.applyCorrection({
      key: 'language',
      instruction: 'Always use TypeScript, not JavaScript.',
      source: 'explicit',
    })

    const prefs = model.getPreferences()
    expect(prefs).toHaveLength(2)
    const keys = prefs.map((p) => p.key).sort()
    expect(keys).toEqual(['language', 'tone'])
  })

  it('getPreference returns the preference by key', () => {
    model.applyCorrection({ key: 'verbosity', instruction: 'Keep it short.', source: 'inferred' })
    const pref = model.getPreference('verbosity')
    expect(pref).toBeDefined()
    expect(pref!.instruction).toBe('Keep it short.')
  })

  it('getPreference returns undefined for unknown key', () => {
    expect(model.getPreference('nonexistent')).toBeUndefined()
  })

  it('builds a prompt block from all preferences', () => {
    model.applyCorrection({
      key: 'format',
      instruction: 'Use markdown headers.',
      source: 'explicit',
    })
    model.applyCorrection({
      key: 'tone',
      instruction: 'Be friendly but professional.',
      source: 'explicit',
    })

    const block = model.buildPromptBlock()
    expect(block).toContain('## User preferences')
    expect(block).toContain('Use markdown headers.')
    expect(block).toContain('Be friendly but professional.')
  })

  it('returns empty string when no preferences exist', () => {
    expect(model.buildPromptBlock()).toBe('')
  })

  it('tracks correction count per key', () => {
    model.applyCorrection({ key: 'style', instruction: 'v1', source: 'explicit' })
    model.applyCorrection({ key: 'style', instruction: 'v2', source: 'explicit' })
    model.applyCorrection({ key: 'style', instruction: 'v3', source: 'explicit' })

    const pref = model.getPreference('style')
    expect(pref!.correctionCount).toBe(3)
  })
})

describe('F-205: Drift detection', () => {
  let model: UserModel

  beforeEach(() => {
    model = new UserModel()
  })

  it('flags a pattern as a mistake via recordMistake', () => {
    model.recordMistake('using-var', 'Used `var` instead of `const`/`let`')
    const mistakes = model.getMistakes()
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]!.pattern).toBe('using-var')
  })

  it('increments recurrence count when same mistake is recorded again', () => {
    model.recordMistake('long-response', 'Response was too verbose')
    model.recordMistake('long-response', 'Response was too verbose again')
    model.recordMistake('long-response', 'Still too long')

    const mistakes = model.getMistakes()
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0]!.recurrenceCount).toBe(3)
  })

  it('detectDrift returns the pattern when it has recurred more than threshold', () => {
    model.recordMistake('wrong-format', 'Wrong format v1')
    model.recordMistake('wrong-format', 'Wrong format v2')
    model.recordMistake('wrong-format', 'Wrong format v3') // 3rd = drift

    const drifts = model.detectDrift({ minRecurrences: 3 })
    expect(drifts).toHaveLength(1)
    expect(drifts[0]!.pattern).toBe('wrong-format')
  })

  it('detectDrift returns empty array when no mistakes exceed threshold', () => {
    model.recordMistake('one-off', 'Happened once')
    const drifts = model.detectDrift({ minRecurrences: 3 })
    expect(drifts).toHaveLength(0)
  })

  it('drift block is included in prompt block when drift exists', () => {
    model.applyCorrection({ key: 'format', instruction: 'Use markdown.', source: 'explicit' })
    model.recordMistake('paragraph-overuse', 'Used paragraphs instead of bullets')
    model.recordMistake('paragraph-overuse', 'Used paragraphs again')
    model.recordMistake('paragraph-overuse', 'Still using paragraphs')

    const block = model.buildPromptBlock({ includeDrift: true, driftThreshold: 3 })
    expect(block).toContain('## User preferences')
    expect(block).toContain('## Recurring mistakes to avoid')
    expect(block).toContain('paragraph-overuse')
  })

  it('exports and imports state correctly', () => {
    model.applyCorrection({ key: 'tone', instruction: 'Be brief.', source: 'explicit' })
    model.recordMistake('verbosity', 'Too long again')
    model.recordMistake('verbosity', 'Still too long')

    const state = model.export()
    const model2 = new UserModel()
    model2.import(state)

    expect(model2.getPreferences()).toHaveLength(1)
    expect(model2.getMistakes()).toHaveLength(1)
    expect(model2.getPreference('tone')!.instruction).toBe('Be brief.')
    expect(model2.getMistakes()[0]!.recurrenceCount).toBe(2)
  })
})
