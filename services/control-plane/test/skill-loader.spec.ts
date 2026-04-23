/**
 * F-202: OpenClaw-compatible skill loader
 * F-203: Credential injection for skills
 * F-204: Bundled skills bootstrap
 *
 * Tests the SkillLoader, SKILL.md parsing, bundled skills, XML prompt block,
 * and credential injection.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadSkillsDir,
  buildSkillsXmlBlock,
  parseSkillMd,
  serialiseSkillMd,
  writeSkillMd,
} from '../src/skill-store.js'
import { bootstrapBundledSkills } from '../src/bundled-skills.js'

const TEST_DIR = join(tmpdir(), `og-skill-loader-test-${process.pid}`)

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// parseSkillMd
// ---------------------------------------------------------------------------

describe('F-202: parseSkillMd', () => {
  it('parses a full SKILL.md file', () => {
    const raw = `---
name: github
description: Access GitHub repos and PRs.
version: 1.0.0
requires:
  env:
    - GITHUB_TOKEN
enabled: true
---

# GitHub

Use gh CLI to interact with repos.
`
    const meta = parseSkillMd(raw, '/tmp/github/SKILL.md')
    expect(meta).not.toBeNull()
    expect(meta!.name).toBe('github')
    expect(meta!.description).toBe('Access GitHub repos and PRs.')
    expect(meta!.version).toBe('1.0.0')
    expect(meta!.requiresEnv).toEqual(['GITHUB_TOKEN'])
    expect(meta!.enabled).toBe(true)
    expect(meta!.body).toContain('Use gh CLI')
  })

  it('parses a skill with no requires block', () => {
    const raw = `---
name: shell-safe
description: Safe shell execution.
version: 1.0.0
enabled: true
---

Run commands safely.
`
    const meta = parseSkillMd(raw, '/tmp/shell-safe/SKILL.md')
    expect(meta).not.toBeNull()
    expect(meta!.requiresEnv).toEqual([])
  })

  it('parses enabled: false', () => {
    const raw = `---
name: disabled-skill
description: A disabled skill.
version: 1.0.0
enabled: false
---

Body here.
`
    const meta = parseSkillMd(raw, '/tmp/disabled/SKILL.md')
    expect(meta).not.toBeNull()
    expect(meta!.enabled).toBe(false)
  })

  it('returns null for malformed frontmatter', () => {
    const raw = `No frontmatter here — just a plain markdown file.`
    const meta = parseSkillMd(raw, '/tmp/bad/SKILL.md')
    expect(meta).toBeNull()
  })

  it('returns null when name or description is missing', () => {
    const raw = `---
version: 1.0.0
enabled: true
---

Body without name or description.
`
    const meta = parseSkillMd(raw, '/tmp/noname/SKILL.md')
    expect(meta).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// serialiseSkillMd + round-trip
// ---------------------------------------------------------------------------

describe('F-202: serialiseSkillMd round-trip', () => {
  it('serialises and parses back to same values', () => {
    const content = serialiseSkillMd({
      name: 'test-skill',
      description: 'A test skill for testing.',
      requiresEnv: ['TEST_KEY', 'OTHER_KEY'],
      enabled: true,
      version: '2.0.0',
      body: '## Workflow\n\n1. Do the thing\n2. Then the other thing',
    })

    const meta = parseSkillMd(content, '/tmp/test/SKILL.md')
    expect(meta).not.toBeNull()
    expect(meta!.name).toBe('test-skill')
    expect(meta!.description).toBe('A test skill for testing.')
    expect(meta!.requiresEnv).toEqual(['TEST_KEY', 'OTHER_KEY'])
    expect(meta!.enabled).toBe(true)
    expect(meta!.version).toBe('2.0.0')
    expect(meta!.body).toContain('Do the thing')
  })
})

// ---------------------------------------------------------------------------
// loadSkillsDir
// ---------------------------------------------------------------------------

describe('F-202: loadSkillsDir', () => {
  it('loads skills from subdirectories', () => {
    // Write two skill dirs
    const content1 = serialiseSkillMd({
      name: 'github',
      description: 'GitHub skill.',
      body: 'Use gh CLI.',
      requiresEnv: ['GITHUB_TOKEN'],
    })
    const content2 = serialiseSkillMd({
      name: 'shell-safe',
      description: 'Shell safety skill.',
      body: 'Run commands safely.',
    })
    writeSkillMd(TEST_DIR, 'github', content1)
    writeSkillMd(TEST_DIR, 'shell-safe', content2)

    const skills = loadSkillsDir(TEST_DIR)
    expect(skills).toHaveLength(2)
    const names = skills.map((s) => s.name).sort()
    expect(names).toEqual(['github', 'shell-safe'])
  })

  it('returns empty array for empty directory', () => {
    const skills = loadSkillsDir(TEST_DIR)
    expect(skills).toEqual([])
  })

  it('returns empty array for non-existent directory', () => {
    const skills = loadSkillsDir('/nonexistent/path/12345')
    expect(skills).toEqual([])
  })

  it('skips directories without SKILL.md', () => {
    // Create dir without SKILL.md
    mkdirSync(join(TEST_DIR, 'no-skill'), { recursive: true })
    const skills = loadSkillsDir(TEST_DIR)
    expect(skills).toEqual([])
  })

  it('skips malformed SKILL.md files', () => {
    const badDir = join(TEST_DIR, 'bad-skill')
    mkdirSync(badDir, { recursive: true })
    writeFileSync(join(badDir, 'SKILL.md'), 'Not a valid frontmatter', 'utf-8')

    const skills = loadSkillsDir(TEST_DIR)
    expect(skills).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// buildSkillsXmlBlock
// ---------------------------------------------------------------------------

describe('F-202: buildSkillsXmlBlock', () => {
  it('builds XML block for enabled skills', () => {
    const content = serialiseSkillMd({
      name: 'github',
      description: 'Access GitHub.',
      body: 'Use gh CLI.',
      requiresEnv: ['GITHUB_TOKEN'],
    })
    writeSkillMd(TEST_DIR, 'github', content)

    const skills = loadSkillsDir(TEST_DIR)
    const block = buildSkillsXmlBlock(skills)
    expect(block).toContain('<skills>')
    expect(block).toContain('<name>github</name>')
    expect(block).toContain('Access GitHub')
    expect(block).toContain('</skills>')
  })

  it('returns empty string when no enabled skills', () => {
    const content = serialiseSkillMd({
      name: 'disabled',
      description: 'Disabled skill.',
      body: 'Body.',
      enabled: false,
    })
    writeSkillMd(TEST_DIR, 'disabled', content)

    const skills = loadSkillsDir(TEST_DIR)
    const block = buildSkillsXmlBlock(skills)
    expect(block).toBe('')
  })

  it('returns empty string for empty skills array', () => {
    const block = buildSkillsXmlBlock([])
    expect(block).toBe('')
  })

  it('escapes XML special characters in description', () => {
    const content = serialiseSkillMd({
      name: 'test-xml',
      description: 'Use <b> & "quotes" for bold.',
      body: 'Body.',
    })
    writeSkillMd(TEST_DIR, 'test-xml', content)

    const skills = loadSkillsDir(TEST_DIR)
    const block = buildSkillsXmlBlock(skills)
    expect(block).not.toContain('<b>')
    expect(block).toContain('&lt;b&gt;')
    expect(block).toContain('&amp;')
  })
})

// ---------------------------------------------------------------------------
// bootstrapBundledSkills
// ---------------------------------------------------------------------------

describe('F-204: bootstrapBundledSkills', () => {
  it('creates the skills directory if it does not exist', () => {
    const dir = join(TEST_DIR, 'skills')
    bootstrapBundledSkills(dir)
    expect(existsSync(dir)).toBe(true)
  })

  it('writes all 4 bundled skills', () => {
    bootstrapBundledSkills(TEST_DIR)
    const skills = loadSkillsDir(TEST_DIR)
    const names = skills.map((s) => s.name).sort()
    expect(names).toContain('github')
    expect(names).toContain('telegram-send')
    expect(names).toContain('browser-research')
    expect(names).toContain('shell-safe')
  })

  it('each bundled skill has name, description, and body', () => {
    bootstrapBundledSkills(TEST_DIR)
    const skills = loadSkillsDir(TEST_DIR)
    for (const s of skills) {
      expect(s.name).toBeTruthy()
      expect(s.description.length).toBeGreaterThan(10)
      expect(s.body.length).toBeGreaterThan(20)
    }
  })

  it('does not overwrite existing skill files', () => {
    // Write github skill with custom content first
    const customContent = serialiseSkillMd({
      name: 'github',
      description: 'My custom GitHub skill.',
      body: 'Custom body.',
    })
    writeSkillMd(TEST_DIR, 'github', customContent)

    // Bootstrap should skip the existing file
    bootstrapBundledSkills(TEST_DIR)

    const skills = loadSkillsDir(TEST_DIR)
    const github = skills.find((s) => s.name === 'github')
    expect(github?.description).toBe('My custom GitHub skill.')
    expect(github?.body).toContain('Custom body.')
  })

  it('github skill declares GITHUB_TOKEN in requiresEnv', () => {
    bootstrapBundledSkills(TEST_DIR)
    const skills = loadSkillsDir(TEST_DIR)
    const github = skills.find((s) => s.name === 'github')
    expect(github?.requiresEnv).toContain('GITHUB_TOKEN')
  })

  it('telegram-send skill declares TELEGRAM_BOT_TOKEN in requiresEnv', () => {
    bootstrapBundledSkills(TEST_DIR)
    const skills = loadSkillsDir(TEST_DIR)
    const telegram = skills.find((s) => s.name === 'telegram-send')
    expect(telegram?.requiresEnv).toContain('TELEGRAM_BOT_TOKEN')
  })

  it('browser-research has no requiresEnv', () => {
    bootstrapBundledSkills(TEST_DIR)
    const skills = loadSkillsDir(TEST_DIR)
    const browser = skills.find((s) => s.name === 'browser-research')
    expect(browser?.requiresEnv).toEqual([])
  })
})
