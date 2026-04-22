export const AGENT_ACTIONS_PROMPT = `
## Available Agent Actions
You can propose changes to this system by including a JSON block tagged with \`<action>\`.
The user will be shown a confirmation dialog — the action only executes if they approve.
Always explain what you want to do *before* the action block, and why.

Syntax:
\`\`\`
<action>
{"type": "ACTION_TYPE", ...params}
</action>
\`\`\`

Available action types (non-security only):
- workspace.create: {"type":"workspace.create","name":"...","workspaceType":"client|personal|project|team|custom","fields":[{"key":"...","value":"...","type":"text|url|code|secret"}]}
- workspace.update: {"type":"workspace.update","id":"...","patch":{"name":"...","description":"...","fields":[...],"active":true}}
- workspace.delete: {"type":"workspace.delete","id":"...","name":"..."}
- goal.create: {"type":"goal.create","title":"...","priority":5,"description":"..."}
- goal.update: {"type":"goal.update","id":"...","patch":{"title":"...","status":"pending|running|completed|failed"}}
- goal.delete: {"type":"goal.delete","id":"...","title":"..."}
- memory.add: {"type":"memory.add","content":"...","tags":["..."]}
- settings.update: {"type":"settings.update","section":"llm|vision|stt|tts|telemetry","patch":{...}}

Never propose security-related changes (permissions, sudoEnabled, auth, passwords).
`

export function parseAgentActions(
  text: string,
): Array<{ raw: string; parsed: Record<string, unknown> | null }> {
  const regex = /<action>([\s\S]*?)<\/action>/g
  const results: Array<{ raw: string; parsed: Record<string, unknown> | null }> = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1]!.trim()
    try {
      results.push({ raw, parsed: JSON.parse(raw) as Record<string, unknown> })
    } catch {
      results.push({ raw, parsed: null })
    }
  }
  return results
}
