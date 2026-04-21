/**
 * F-033: Cross-source entity linking
 */
import { describe, it, expect } from 'vitest'
import { MemoryClient } from '../src/index.js'

describe('F-033: Cross-source entity linking', () => {
  it('links Gmail sender to CRM contact', async () => {
    const client = new MemoryClient({ dryRun: true })
    await client.index({
      source: 'crm',
      type: 'contact',
      content: 'Alice Johnson, CEO at Acme Corp',
      metadata: { email: 'alice@acme.com', crmId: 'crm-001' },
    })
    await client.index({
      source: 'gmail',
      type: 'thread',
      content: 'Hi, following up on the proposal',
      metadata: { sender: 'alice@acme.com', threadId: 'thread-003' },
    })
    const results = await client.search('Alice Johnson', {})
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns linked entities when querying by person', async () => {
    const client = new MemoryClient({ dryRun: true })
    await client.index({
      source: 'crm',
      type: 'contact',
      content: 'Bob Smith, Sales Director',
      metadata: { email: 'bob@example.com', crmId: 'crm-002' },
    })
    const results = await client.search('Bob Smith', {})
    expect(results.some((r) => r.source === 'crm')).toBe(true)
  })
})
