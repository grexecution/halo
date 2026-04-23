/**
 * SkillLoader — singleton that manages the skill registry at runtime.
 *
 * Responsibilities:
 *  - Bootstrap bundled skills on first boot
 *  - Load all skills from ~/.open-greg/skills/
 *  - Watch for changes and hot-reload (debounced 500ms)
 *  - Inject credentials from secure storage into process.env before each turn
 *  - Build the XML prompt block appended to every system prompt
 *  - Provide CRUD for skill files (used by API routes + tools)
 */
import { watch, existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import {
  loadSkillsDir,
  buildSkillsXmlBlock,
  writeSkillMd,
  serialiseSkillMd,
  type SkillMeta,
} from './skill-store.js'
import { bootstrapBundledSkills } from './bundled-skills.js'
import { getSecret, setSecret, deleteSecret } from '@open-greg/shared/secrets'

const SKILLS_DIR = join(homedir(), '.open-greg', 'skills')

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export class SkillLoader {
  private skills: SkillMeta[] = []
  private watcher: ReturnType<typeof watch> | null = null
  private reloadTimer: ReturnType<typeof setTimeout> | null = null
  private ready = false
  /** The directory this loader reads from. Injectable for tests. */
  readonly dir: string

  constructor(dir?: string) {
    this.dir = dir ?? SKILLS_DIR
  }

  /** Call once at startup */
  init(): void {
    if (this.ready) return
    bootstrapBundledSkills(this.dir)
    this.reload()
    this.startWatcher()
    this.ready = true
  }

  reload(): void {
    this.skills = loadSkillsDir(this.dir)
  }

  /** All loaded skills (enabled + disabled) */
  list(): SkillMeta[] {
    return this.skills
  }

  /** Get a single skill by name */
  get(name: string): SkillMeta | undefined {
    return this.skills.find((s) => s.name === name)
  }

  /**
   * Build the XML block injected into every system prompt.
   * Skills with missing credentials get a ⚠ warning in their description.
   */
  async buildPromptBlock(): Promise<string> {
    const enriched = await Promise.all(
      this.skills
        .filter((s) => s.enabled)
        .map(async (s) => {
          const missing = await this.missingCredentials(s.name)
          if (missing.length === 0) return s
          return {
            ...s,
            description: `${s.description} ⚠ Missing credentials: ${missing.join(', ')} — tell the user to connect this skill`,
          }
        }),
    )
    return buildSkillsXmlBlock(enriched)
  }

  /**
   * Inject credentials for all enabled skills into process.env.
   * Called at the start of each agent turn.
   */
  async injectCredentials(): Promise<void> {
    for (const skill of this.skills) {
      if (!skill.enabled) continue
      for (const envKey of skill.requiresEnv) {
        if (process.env[envKey]) continue // already set
        try {
          const value = await getSecret('skills', envKey)
          if (value) process.env[envKey] = value
        } catch {
          // Not stored — will show ⚠ in prompt
        }
      }
    }
  }

  /** Returns list of env var names that are required but not stored */
  async missingCredentials(skillName: string): Promise<string[]> {
    const skill = this.get(skillName)
    if (!skill) return []
    const missing: string[] = []
    for (const key of skill.requiresEnv) {
      if (process.env[key]) continue
      try {
        const val = await getSecret('skills', key)
        if (!val) missing.push(key)
      } catch {
        missing.push(key)
      }
    }
    return missing
  }

  /** Store a credential for a skill */
  async storeCredential(envKey: string, value: string): Promise<void> {
    await setSecret('skills', envKey, value)
    process.env[envKey] = value
    // No reload needed — prompt block is rebuilt on next turn
  }

  /** Remove a stored credential */
  async deleteCredential(envKey: string): Promise<void> {
    await deleteSecret('skills', envKey)
    delete process.env[envKey]
  }

  /** Create or replace a skill on disk */
  createOrUpdate(opts: {
    name: string
    description: string
    body: string
    requiresEnv?: string[]
    enabled?: boolean
    version?: string
  }): SkillMeta {
    const content = serialiseSkillMd({
      name: opts.name,
      description: opts.description,
      requiresEnv: opts.requiresEnv ?? [],
      enabled: opts.enabled !== false,
      version: opts.version ?? '1.0.0',
      body: opts.body,
    })
    const path = writeSkillMd(this.dir, opts.name, content)
    this.reload()
    return (
      this.get(opts.name) ?? {
        name: opts.name,
        description: opts.description,
        version: opts.version ?? '1.0.0',
        requiresEnv: opts.requiresEnv ?? [],
        enabled: opts.enabled !== false,
        body: opts.body,
        path,
      }
    )
  }

  /** Toggle enabled/disabled */
  toggle(name: string, enabled: boolean): boolean {
    const skill = this.get(name)
    if (!skill) return false
    const raw = readFileSync(skill.path, 'utf-8')
    const updated = raw.replace(/^enabled:\s*(true|false)$/m, `enabled: ${enabled}`)
    writeFileSync(skill.path, updated, 'utf-8')
    this.reload()
    return true
  }

  /** Delete a skill directory */
  delete(name: string): boolean {
    const skill = this.get(name)
    if (!skill) return false
    const skillDir = dirname(skill.path)
    rmSync(skillDir, { recursive: true, force: true })
    this.reload()
    return true
  }

  get skillsDir(): string {
    return this.dir
  }

  // ---------------------------------------------------------------------------
  // File watcher
  // ---------------------------------------------------------------------------

  private startWatcher(): void {
    if (!existsSync(this.dir)) return
    try {
      this.watcher = watch(this.dir, { recursive: true }, () => {
        if (this.reloadTimer) clearTimeout(this.reloadTimer)
        this.reloadTimer = setTimeout(() => this.reload(), 500)
      })
    } catch {
      // File watching is best-effort
    }
  }

  stop(): void {
    this.watcher?.close()
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
  }
}

export const skillLoader = new SkillLoader()

export { SKILLS_DIR }
