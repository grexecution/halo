/**
 * F-200: SkillStore
 *
 * Persists agent-generated skills as SKILL.md files on disk.
 * Path: <skillsDir>/<agentId>/<skillName>.md
 *
 * All writes go through the fs module directly (no permission middleware)
 * because this is an internal control-plane operation, not an agent tool call.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

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

    const content = serialise(skill)
    writeFileSync(this.skillPath(agentId, name), content, 'utf-8')
    return skill
  }

  async list(agentId: string): Promise<Skill[]> {
    const dir = this.agentDir(agentId)
    if (!existsSync(dir)) return []

    const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
    return files.map((f) => {
      const raw = readFileSync(join(dir, f), 'utf-8')
      return deserialise(raw)
    })
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
// Serialisation helpers — frontmatter-style markdown
// ---------------------------------------------------------------------------

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function serialise(skill: Skill): string {
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

function deserialise(raw: string): Skill {
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
