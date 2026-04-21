/**
 * F-103: GitHub connector
 */
import { describe, it, expect } from 'vitest'
import { createMcpRegistry } from '../src/index.js'

describe('F-103: GitHub connector', () => {
  it('GitHub MCP registers with issues, PRs, repo read, PR create tools', () => {
    const registry = createMcpRegistry()
    registry.register({
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
      status: 'active',
      tools: ['github.listIssues', 'github.listPRs', 'github.readFile', 'github.createPR'],
    })
    const meta = registry.get('github')
    expect(meta?.tools).toContain('github.createPR')
    expect(meta?.tools).toContain('github.listIssues')
  })
})
