/**
 * F-205: Skill tools (create_skill, edit_skill, connect_skill)
 *
 * Tests that the Mastra tools correctly delegate to SkillLoader.
 * We test the core logic through the skill-loader directly (integration-style)
 * since the tools themselves wrap skillLoader calls behind permission middleware.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillLoader } from '../src/skill-loader.js'

const TEST_DIR = join(tmpdir(), `og-skill-tools-test-${process.pid}`)

let loader: SkillLoader

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  // Create a fresh loader scoped to the test directory
  loader = new SkillLoader(TEST_DIR)
})

afterEach(() => {
  loader.stop()
  rmSync(TEST_DIR, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// createOrUpdate (backing logic of create_skill tool)
// ---------------------------------------------------------------------------

describe('F-205: create_skill logic', () => {
  it('creates a new skill on disk', () => {
    const skill = loader.createOrUpdate({
      name: 'my-skill',
      description: 'A test skill.',
      body: '## Workflow\n\nDo this.',
    })

    expect(skill.name).toBe('my-skill')
    expect(existsSync(join(TEST_DIR, 'my-skill', 'SKILL.md'))).toBe(true)
  })

  it('created skill is immediately listed', () => {
    loader.createOrUpdate({
      name: 'instant-skill',
      description: 'Appears right away.',
      body: 'Body here.',
    })

    const all = loader.list()
    expect(all.some((s) => s.name === 'instant-skill')).toBe(true)
  })

  it('creates skill with requiresEnv', () => {
    loader.createOrUpdate({
      name: 'cred-skill',
      description: 'Needs API key.',
      body: 'Use the API.',
      requiresEnv: ['MY_API_KEY'],
    })

    const skill = loader.get('cred-skill')
    expect(skill?.requiresEnv).toContain('MY_API_KEY')
  })

  it('replaces existing skill when called again with same name', () => {
    loader.createOrUpdate({
      name: 'overwrite-me',
      description: 'Old description.',
      body: 'Old body.',
    })

    loader.createOrUpdate({
      name: 'overwrite-me',
      description: 'New description.',
      body: 'New body.',
    })

    const skill = loader.get('overwrite-me')
    expect(skill?.description).toBe('New description.')
    expect(skill?.body).toContain('New body.')
  })
})

// ---------------------------------------------------------------------------
// edit_skill logic
// ---------------------------------------------------------------------------

describe('F-205: edit_skill logic', () => {
  beforeEach(() => {
    loader.createOrUpdate({
      name: 'editable',
      description: 'Original description.',
      body: 'Original body.',
      requiresEnv: ['ORIG_KEY'],
    })
  })

  it('edit preserves unchanged fields', () => {
    loader.createOrUpdate({
      name: 'editable',
      description: 'Updated description.',
      body: loader.get('editable')?.body ?? '',
      requiresEnv: loader.get('editable')?.requiresEnv ?? [],
    })

    const skill = loader.get('editable')
    expect(skill?.description).toBe('Updated description.')
    expect(skill?.requiresEnv).toContain('ORIG_KEY')
  })

  it('returns undefined for non-existent skill', () => {
    const skill = loader.get('does-not-exist')
    expect(skill).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// toggle (enable/disable)
// ---------------------------------------------------------------------------

describe('F-205: toggle skill', () => {
  it('disables an enabled skill', () => {
    loader.createOrUpdate({
      name: 'toggleable',
      description: 'Can be toggled.',
      body: 'Body.',
      enabled: true,
    })

    const ok = loader.toggle('toggleable', false)
    expect(ok).toBe(true)
    expect(loader.get('toggleable')?.enabled).toBe(false)
  })

  it('enables a disabled skill', () => {
    loader.createOrUpdate({
      name: 'disabled-skill',
      description: 'Starts disabled.',
      body: 'Body.',
      enabled: false,
    })

    loader.toggle('disabled-skill', true)
    expect(loader.get('disabled-skill')?.enabled).toBe(true)
  })

  it('returns false for non-existent skill', () => {
    const ok = loader.toggle('ghost-skill', true)
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// delete skill
// ---------------------------------------------------------------------------

describe('F-205: delete skill', () => {
  it('removes the skill from disk and list', () => {
    loader.createOrUpdate({
      name: 'delete-me',
      description: 'Will be deleted.',
      body: 'Body.',
    })

    expect(existsSync(join(TEST_DIR, 'delete-me'))).toBe(true)
    const ok = loader.delete('delete-me')
    expect(ok).toBe(true)
    expect(existsSync(join(TEST_DIR, 'delete-me'))).toBe(false)
    expect(loader.get('delete-me')).toBeUndefined()
  })

  it('returns false for non-existent skill', () => {
    const ok = loader.delete('ghost')
    expect(ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// buildPromptBlock
// ---------------------------------------------------------------------------

describe('F-205: buildPromptBlock', () => {
  it('includes enabled skills with no missing credentials', async () => {
    loader.createOrUpdate({
      name: 'no-cred-skill',
      description: 'Requires no credentials.',
      body: 'Just works.',
      enabled: true,
    })

    const block = await loader.buildPromptBlock()
    expect(block).toContain('no-cred-skill')
    expect(block).toContain('Requires no credentials.')
  })

  it('marks skills with missing credentials', async () => {
    loader.createOrUpdate({
      name: 'needs-key',
      description: 'Needs a key.',
      body: 'Use the key.',
      requiresEnv: ['MISSING_API_KEY'],
      enabled: true,
    })

    // Don't store the credential — it should appear as missing
    const block = await loader.buildPromptBlock()
    expect(block).toContain('MISSING_API_KEY')
    // Should have warning marker
    expect(block).toMatch(/⚠|Missing credentials/)
  })

  it('excludes disabled skills from prompt block', async () => {
    loader.createOrUpdate({
      name: 'hidden-skill',
      description: 'Should not appear.',
      body: 'Hidden.',
      enabled: false,
    })

    const block = await loader.buildPromptBlock()
    expect(block).not.toContain('hidden-skill')
  })

  it('returns empty string when no enabled skills', async () => {
    const block = await loader.buildPromptBlock()
    expect(block).toBe('')
  })
})

// ---------------------------------------------------------------------------
// missingCredentials
// ---------------------------------------------------------------------------

describe('F-203: missingCredentials', () => {
  it('returns empty array for skill with no requiresEnv', async () => {
    loader.createOrUpdate({
      name: 'free-skill',
      description: 'No creds needed.',
      body: 'Body.',
      requiresEnv: [],
    })

    const missing = await loader.missingCredentials('free-skill')
    expect(missing).toEqual([])
  })

  it('returns missing keys when env vars not set', async () => {
    delete process.env['TEST_MISSING_KEY_XYZ']
    loader.createOrUpdate({
      name: 'needs-creds',
      description: 'Needs creds.',
      body: 'Use creds.',
      requiresEnv: ['TEST_MISSING_KEY_XYZ'],
    })

    const missing = await loader.missingCredentials('needs-creds')
    expect(missing).toContain('TEST_MISSING_KEY_XYZ')
  })

  it('returns empty when env var is already set in process.env', async () => {
    process.env['TEST_PRESENT_KEY_ABC'] = 'test-value'
    loader.createOrUpdate({
      name: 'has-env',
      description: 'Env is pre-set.',
      body: 'Use it.',
      requiresEnv: ['TEST_PRESENT_KEY_ABC'],
    })

    const missing = await loader.missingCredentials('has-env')
    expect(missing).not.toContain('TEST_PRESENT_KEY_ABC')

    delete process.env['TEST_PRESENT_KEY_ABC']
  })

  it('returns empty array for non-existent skill', async () => {
    const missing = await loader.missingCredentials('ghost-skill')
    expect(missing).toEqual([])
  })
})
