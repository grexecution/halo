/**
 * F-200: SkillReflector
 *
 * After a session accumulates N tool calls, the reflector calls a lightweight
 * LLM to extract a reusable procedure and persists it via SkillStore.
 *
 * The `generate` function is injected so this module stays testable without
 * hitting a real LLM.
 */
import type { SkillStore, SkillInput } from './skill-store.js'

export interface ToolCallEntry {
  toolId: string
  args: unknown
  result: unknown
}

export interface GeneratedSkill extends SkillInput {
  name: string
}

export interface SkillReflectorOptions {
  /**
   * Function that takes a tool-call log and returns a generated skill.
   * In production this calls the LLM. In tests it's mocked.
   */
  generate: (toolCallLog: ToolCallEntry[]) => Promise<GeneratedSkill>
  /** Minimum number of tool calls required before reflection. Default: 1. */
  minToolCalls?: number
}

export class SkillReflector {
  private generate: (toolCallLog: ToolCallEntry[]) => Promise<GeneratedSkill>
  private minToolCalls: number

  constructor(
    private store: SkillStore,
    opts: SkillReflectorOptions,
  ) {
    this.generate = opts.generate
    this.minToolCalls = opts.minToolCalls ?? 1
  }

  /**
   * Attempt to extract and store a skill from the tool call log.
   * Silently swallows errors — skill generation is best-effort.
   */
  async reflect(agentId: string, toolCallLog: ToolCallEntry[]): Promise<void> {
    if (toolCallLog.length < this.minToolCalls) return

    try {
      const skill = await this.generate(toolCallLog)
      if (!skill?.name || !skill?.title || !skill?.body) return
      await this.store.write(agentId, skill.name, {
        title: skill.title,
        body: skill.body,
        tags: skill.tags ?? [],
      })
    } catch {
      // Best-effort — never crash the agent session over skill generation
    }
  }
}

// ---------------------------------------------------------------------------
// Production LLM-backed generate function
// ---------------------------------------------------------------------------

/**
 * Build the production generate function using whatever LLM model is provided.
 * The model is called with a structured prompt; response is JSON-parsed.
 */
export function buildLLMGenerateFn(
  callLLM: (prompt: string) => Promise<string>,
): (toolCallLog: ToolCallEntry[]) => Promise<GeneratedSkill> {
  return async (toolCallLog: ToolCallEntry[]) => {
    const logSummary = toolCallLog.map((t) => `- ${t.toolId}(${JSON.stringify(t.args)})`).join('\n')

    const prompt = `You are analyzing an AI agent session. Given the following tool calls, extract a reusable skill.

Tool calls:
${logSummary}

Respond with a JSON object (no markdown, just JSON):
{
  "name": "kebab-case-skill-name",
  "title": "Short human-readable title",
  "body": "When to use this skill and how to execute it (2-4 sentences)",
  "tags": ["tag1", "tag2"]
}`

    const raw = await callLLM(prompt)
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()
    return JSON.parse(cleaned) as GeneratedSkill
  }
}
