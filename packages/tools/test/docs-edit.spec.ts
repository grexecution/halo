/**
 * F-140: Agent edits own docs
 */
import { describe, it, expect } from 'vitest'
import { docsEditTool } from '../src/docs-edit.js'
import { createMiddleware } from '@open-greg/permissions'

describe('F-140: Agent edits own docs', () => {
  it('allows docs edit when permission is granted', async () => {
    const mw = createMiddleware({ tools: { 'docs.edit': { allow: true } } })
    const result = await docsEditTool.run(
      { file: 'docs/FEATURES.md', changes: '## Added F-200\n', dryRun: true },
      { sessionId: 's1', agentId: 'a1', middleware: mw },
    )
    expect(result.ok).toBe(true)
    expect(result.commitHash).toBeTruthy()
  })

  it('denies docs edit when permission is not granted', async () => {
    const mw = createMiddleware({ tools: { 'docs.edit': { allow: false } } })
    await expect(
      docsEditTool.run(
        { file: 'docs/FEATURES.md', changes: 'hacked', dryRun: true },
        { sessionId: 's1', agentId: 'a1', middleware: mw },
      ),
    ).rejects.toThrow(/denied/i)
  })

  it('returns commit metadata with trace info', async () => {
    const mw = createMiddleware({ tools: { 'docs.edit': { allow: true } } })
    const result = await docsEditTool.run(
      { file: 'docs/FEATURES.md', changes: '<!-- trace: sess-001 -->\n', dryRun: true },
      { sessionId: 'sess-001', agentId: 'a1', middleware: mw },
    )
    expect(result.traceSessionId).toBe('sess-001')
  })
})
