/**
 * SkillStore — persists skills as SKILL.md files on disk.
 *
 * Two kinds of skills:
 *  1. User/bundled skills: ~/.open-greg/skills/<name>/SKILL.md  (OpenClaw-compatible)
 *  2. Auto-generated skills: ~/.open-greg/skills/<agentId>/<name>.md  (legacy flat format)
 *
 * The buildSystemPromptBlock() method merges both into a compact XML list
 * (same format as OpenClaw's formatSkillsForPrompt).
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Skill {
  name: string
  title: string
  body: string
  tags: string[]
  updatedAt: string
}

export interface SkillInput {
  title: string
  body: string
  tags: string[]
}

export interface SkillMeta {
  name: string
  description: string
  version: string
  requiresEnv: string[]
  enabled: boolean
  /** Full markdown body (everything after frontmatter) */
  body: string
  /** Source path on disk */
  path: string
}

// ---------------------------------------------------------------------------
// SkillStore — auto-generated skills (per-agent flat .md files)
// ---------------------------------------------------------------------------

export class SkillStore {
  constructor(private baseDir: string) {}

  private agentDir(agentId: string): string {
    return join(this.baseDir, agentId)
  }

  private skillPath(agentId: string, name: string): string {
    return join(this.agentDir(agentId), `${sanitizeName(name)}.md`)
  }

  async write(agentId: string, name: string, input: SkillInput): Promise<Skill> {
    const dir = this.agentDir(agentId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const skill: Skill = {
      name: sanitizeName(name),
      title: input.title,
      body: input.body,
      tags: input.tags,
      updatedAt: new Date().toISOString(),
    }

    writeFileSync(this.skillPath(agentId, name), serialiseLegacy(skill), 'utf-8')
    return skill
  }

  async list(agentId: string): Promise<Skill[]> {
    const dir = this.agentDir(agentId)
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => deserialiseLegacy(readFileSync(join(dir, f), 'utf-8')))
  }

  async buildPromptBlock(agentId: string): Promise<string> {
    const skills = await this.list(agentId)
    if (skills.length === 0) return ''

    const lines: string[] = ['## Learned skills', '']
    for (const s of skills) {
      lines.push(`### ${s.title}`)
      lines.push(s.body)
      if (s.tags.length > 0) lines.push(`_tags: ${s.tags.join(', ')}_`)
      lines.push('')
    }
    return lines.join('\n').trimEnd()
  }
}

// ---------------------------------------------------------------------------
// SKILL.md loader — reads OpenClaw-compatible skill directories
// ---------------------------------------------------------------------------

/**
 * Load all skills from a directory of skill folders.
 * Each subfolder must contain a SKILL.md file.
 *
 * skillsDir/
 *   github/
 *     SKILL.md
 *   telegram-send/
 *     SKILL.md
 */
export function loadSkillsDir(skillsDir: string): SkillMeta[] {
  if (!existsSync(skillsDir)) return []

  const results: SkillMeta[] = []

  for (const entry of readdirSync(skillsDir)) {
    const entryPath = join(skillsDir, entry)
    // Only process directories
    try {
      if (!statSync(entryPath).isDirectory()) continue
    } catch {
      continue
    }

    const skillMdPath = join(entryPath, 'SKILL.md')
    if (!existsSync(skillMdPath)) continue

    try {
      const raw = readFileSync(skillMdPath, 'utf-8')
      const meta = parseSkillMd(raw, skillMdPath)
      if (meta) results.push(meta)
    } catch {
      // Skip malformed skills
    }
  }

  return results
}

/**
 * Write a skill directory + SKILL.md file.
 */
export function writeSkillMd(skillsDir: string, name: string, content: string): string {
  const slug = sanitizeName(name)
  const dir = join(skillsDir, slug)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = join(dir, 'SKILL.md')
  writeFileSync(path, content, 'utf-8')
  return path
}

/**
 * Build the compact XML block injected into every system prompt.
 * Format mirrors OpenClaw's formatSkillsForPrompt.
 */
export function buildSkillsXmlBlock(skills: SkillMeta[]): string {
  const enabled = skills.filter((s) => s.enabled)
  if (enabled.length === 0) return ''

  const items = enabled
    .map((s) => {
      const credWarning = s.requiresEnv.length > 0 ? ` [requires: ${s.requiresEnv.join(', ')}]` : ''
      return `  <skill>\n    <name>${xmlEsc(s.name)}</name>\n    <description>${xmlEsc(s.description)}${xmlEsc(credWarning)}</description>\n  </skill>`
    })
    .join('\n')

  return `<skills>\n${items}\n</skills>`
}

/**
 * Serialise a skill to SKILL.md format.
 */
export function serialiseSkillMd(opts: {
  name: string
  description: string
  requiresEnv?: string[]
  enabled?: boolean
  version?: string
  body: string
}): string {
  const fm: string[] = [
    '---',
    `name: ${opts.name}`,
    `description: ${opts.description}`,
    `version: ${opts.version ?? '1.0.0'}`,
  ]
  if (opts.requiresEnv && opts.requiresEnv.length > 0) {
    fm.push('requires:')
    fm.push('  env:')
    for (const e of opts.requiresEnv) fm.push(`    - ${e}`)
  }
  fm.push(`enabled: ${opts.enabled !== false}`)
  fm.push('---')
  fm.push('')
  fm.push(opts.body.trim())
  return fm.join('\n')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function xmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Parse a SKILL.md file into SkillMeta. Returns null on failure. */
export function parseSkillMd(raw: string, path: string): SkillMeta | null {
  if (!raw.startsWith('---')) return null

  const endFm = raw.indexOf('\n---', 3)
  if (endFm === -1) return null

  const frontmatter = raw.slice(3, endFm).trim()
  const body = raw.slice(endFm + 4).trim()

  const get = (key: string): string => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return m?.[1]?.trim() ?? ''
  }

  const name = get('name')
  const description = get('description')
  if (!name || !description) return null

  // Parse requires.env block
  const requiresEnv: string[] = []
  const requiresMatch = frontmatter.match(/requires:\s*\n\s+env:\s*\n((?:\s+-\s+\S+\n?)+)/)
  if (requiresMatch?.[1]) {
    for (const line of requiresMatch[1].split('\n')) {
      const m = line.match(/^\s+-\s+(\S+)/)
      if (m?.[1]) requiresEnv.push(m[1])
    }
  }

  const enabledRaw = get('enabled')
  const enabled = enabledRaw !== 'false'

  return {
    name,
    description,
    version: get('version') || '1.0.0',
    requiresEnv,
    enabled,
    body,
    path,
  }
}

// ---------------------------------------------------------------------------
// Legacy flat-file format helpers (auto-generated skills)
// ---------------------------------------------------------------------------

function serialiseLegacy(skill: Skill): string {
  return [
    '---',
    `title: ${skill.title}`,
    `tags: ${skill.tags.join(', ')}`,
    `updatedAt: ${skill.updatedAt}`,
    '---',
    '',
    skill.body,
  ].join('\n')
}

function deserialiseLegacy(raw: string): Skill {
  const [, front = '', ...bodyParts] = raw.split('---')
  const body = bodyParts.join('---').trim()

  const get = (key: string): string => {
    const match = front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return match?.[1]?.trim() ?? ''
  }

  const tagsRaw = get('tags')
  return {
    name: '',
    title: get('title'),
    body,
    tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()) : [],
    updatedAt: get('updatedAt'),
  }
}
