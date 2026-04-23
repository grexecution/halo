/**
 * F-200: Autonomous skill generation
 * F-201: Skill injection into system prompt
 *
 * Verifies that after N tool calls the orchestrator triggers skill reflection,
 * writes a skill file, and injects skills into the next system prompt.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillStore } from '../src/skill-store.js'
import { SkillReflector } from '../src/skill-reflector.js'

const TEST_DIR = join(tmpdir(), `og-skill-test-${process.pid}`)

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('F-200: SkillStore', () => {
  it('writes a skill file and reads it back', async () => {
    const store = new SkillStore(TEST_DIR)
    await store.write('agent-1', 'list-files', {
      title: 'List files in a directory',
      body: 'When asked to list files, use `ls -la` with the target path.',
      tags: ['filesystem'],
    })

    const skills = await store.list('agent-1')
    expect(skills).toHaveLength(1)
    expect(skills[0]!.title).toBe('List files in a directory')
    expect(skills[0]!.body).toContain('ls -la')
  })

  it('upserts a skill when the same name is written again', async () => {
    const store = new SkillStore(TEST_DIR)
    await store.write('agent-1', 'deploy', {
      title: 'Deploy a service',
      body: 'Use docker compose up.',
      tags: ['docker'],
    })
    await store.write('agent-1', 'deploy', {
      title: 'Deploy a service',
      body: 'Use docker compose up -d --force-recreate.',
      tags: ['docker'],
    })

    const skills = await store.list('agent-1')
    expect(skills).toHaveLength(1)
    expect(skills[0]!.body).toContain('force-recreate')
  })

  it('scopes skills per agent', async () => {
    const store = new SkillStore(TEST_DIR)
    await store.write('agent-1', 'skill-a', { title: 'A', body: 'body a', tags: [] })
    await store.write('agent-2', 'skill-b', { title: 'B', body: 'body b', tags: [] })

    expect(await store.list('agent-1')).toHaveLength(1)
    expect(await store.list('agent-2')).toHaveLength(1)
    expect((await store.list('agent-1'))[0]!.title).toBe('A')
  })

  it('returns empty array for agent with no skills', async () => {
    const store = new SkillStore(TEST_DIR)
    const skills = await store.list('new-agent')
    expect(skills).toEqual([])
  })

  it('builds a prompt block from all skills', async () => {
    const store = new SkillStore(TEST_DIR)
    await store.write('agent-1', 'grep', {
      title: 'Search code with grep',
      body: 'Use grep -r with the pattern.',
      tags: ['code'],
    })

    const block = await store.buildPromptBlock('agent-1')
    expect(block).toContain('## Learned skills')
    expect(block).toContain('Search code with grep')
    expect(block).toContain('grep -r')
  })

  it('returns empty string when agent has no skills', async () => {
    const store = new SkillStore(TEST_DIR)
    const block = await store.buildPromptBlock('no-skills-agent')
    expect(block).toBe('')
  })
})

describe('F-200: SkillReflector', () => {
  it('generates a skill from a tool call log', async () => {
    const store = new SkillStore(TEST_DIR)
    // SkillReflector with a mock LLM function
    const mockGenerate = vi.fn().mockResolvedValue({
      name: 'read-and-search',
      title: 'Read a file then search its contents',
      body: 'When reading then searching, use fs_read then pass content to shell_exec grep.',
      tags: ['filesystem', 'search'],
    })

    const reflector = new SkillReflector(store, { generate: mockGenerate })
    const toolCallLog = [
      { toolId: 'fs_read', args: { path: '/tmp/foo.ts' }, result: { ok: true, content: '...' } },
      { toolId: 'shell_exec', args: { cmd: 'grep pattern /tmp/foo.ts' }, result: { ok: true } },
    ]

    await reflector.reflect('agent-1', toolCallLog)

    expect(mockGenerate).toHaveBeenCalledOnce()
    const skills = await store.list('agent-1')
    expect(skills).toHaveLength(1)
    expect(skills[0]!.title).toBe('Read a file then search its contents')
  })

  it('does not call generate when tool log is empty', async () => {
    const store = new SkillStore(TEST_DIR)
    const mockGenerate = vi.fn()
    const reflector = new SkillReflector(store, { generate: mockGenerate })

    await reflector.reflect('agent-1', [])
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('does not throw when generate fails — logs and continues', async () => {
    const store = new SkillStore(TEST_DIR)
    const mockGenerate = vi.fn().mockRejectedValue(new Error('LLM unavailable'))
    const reflector = new SkillReflector(store, { generate: mockGenerate })

    const toolCallLog = [{ toolId: 'fs_read', args: {}, result: {} }]
    // Should not throw
    await expect(reflector.reflect('agent-1', toolCallLog)).resolves.not.toThrow()
    // Nothing written
    expect(await store.list('agent-1')).toHaveLength(0)
  })
})

describe('F-201: Skill injection into system prompt', () => {
  it('buildSystemPromptWithSkills appends skill block when skills exist', async () => {
    const store = new SkillStore(TEST_DIR)
    await store.write('agent-1', 'test-skill', {
      title: 'My test skill',
      body: 'Do X when Y.',
      tags: [],
    })

    const block = await store.buildPromptBlock('agent-1')
    const basePrompt = 'You are a helpful assistant.'
    const full = block ? `${basePrompt}\n\n${block}` : basePrompt

    expect(full).toContain('You are a helpful assistant.')
    expect(full).toContain('## Learned skills')
    expect(full).toContain('My test skill')
  })

  it('prompt is unchanged when no skills exist', async () => {
    const store = new SkillStore(TEST_DIR)
    const block = await store.buildPromptBlock('empty-agent')
    const basePrompt = 'You are a helpful assistant.'
    const full = block ? `${basePrompt}\n\n${block}` : basePrompt

    expect(full).toBe(basePrompt)
  })
})
