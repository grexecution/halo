/**
 * F-141: Stuck-loop detector
 */
import { describe, it, expect } from 'vitest'
import { StuckLoopDetector } from '../src/stuck-detector.js'

describe('F-141: Stuck-loop detector', () => {
  it('returns no-progress when tool calls are identical', () => {
    const detector = new StuckLoopDetector({ windowSize: 3 })
    const turns = [
      { toolCall: 'browser.scrape("https://example.com")' },
      { toolCall: 'browser.scrape("https://example.com")' },
      { toolCall: 'browser.scrape("https://example.com")' },
    ]
    const result = detector.analyze(turns)
    expect(result.stuck).toBe(true)
    expect(result.reason).toMatch(/repeated/i)
  })

  it('returns making-progress when tool calls are varied', () => {
    const detector = new StuckLoopDetector({ windowSize: 3 })
    const turns = [
      { toolCall: 'browser.scrape("https://example.com")' },
      { toolCall: 'fs.read("/tmp/data.json")' },
      { toolCall: 'shell_exec("echo done")' },
    ]
    const result = detector.analyze(turns)
    expect(result.stuck).toBe(false)
  })

  it('injects reset prompt when stuck', () => {
    const detector = new StuckLoopDetector({ windowSize: 3 })
    const turns = [
      { toolCall: 'search("query")' },
      { toolCall: 'search("query")' },
      { toolCall: 'search("query")' },
    ]
    const result = detector.analyze(turns)
    expect(result.stuck).toBe(true)
    expect(result.resetPrompt).toBeTruthy()
  })

  it('requires at least windowSize turns before detecting', () => {
    const detector = new StuckLoopDetector({ windowSize: 3 })
    const turns = [{ toolCall: 'search("same")' }, { toolCall: 'search("same")' }]
    const result = detector.analyze(turns)
    expect(result.stuck).toBe(false)
  })
})
