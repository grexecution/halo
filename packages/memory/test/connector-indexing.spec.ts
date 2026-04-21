/**
 * F-032: Connector pull indexing
 */
import { describe, it, expect } from 'vitest'
import { MemoryClient } from '../src/index.js'

describe('F-032: Connector pull indexing', () => {
  it('indexes a Gmail thread into memory', async () => {
    const client = new MemoryClient({ dryRun: true })
    const entry = await client.index({
      source: 'gmail',
      type: 'thread',
      content: 'Subject: Q4 review\nFrom: alice@example.com\nHello, can we schedule a Q4 review?',
      metadata: { threadId: 'thread-001', sender: 'alice@example.com' },
    })
    expect(entry.id).toBeTruthy()
    expect(entry.source).toBe('gmail')
  })

  it('indexes a GitHub issue into memory', async () => {
    const client = new MemoryClient({ dryRun: true })
    const entry = await client.index({
      source: 'github',
      type: 'issue',
      content: 'Bug: login fails on Safari. Steps to reproduce: ...',
      metadata: { issueNumber: 42, repo: 'org/repo' },
    })
    expect(entry.source).toBe('github')
    expect(entry.type).toBe('issue')
  })

  it('makes indexed connector content searchable', async () => {
    const client = new MemoryClient({ dryRun: true })
    await client.index({
      source: 'gmail',
      type: 'thread',
      content: 'Q4 budget approval needed',
      metadata: { threadId: 'thread-002' },
    })
    const results = await client.search('Q4 budget', {})
    expect(results.length).toBeGreaterThan(0)
  })
})
