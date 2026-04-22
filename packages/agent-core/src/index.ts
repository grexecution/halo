export function buildSystemPrompt(basePrompt: string, timezone?: string | undefined): string {
  const tz = timezone ?? 'UTC'
  const now = new Date().toLocaleString('en-US', {
    timeZone: tz,
    dateStyle: 'full',
    timeStyle: 'long',
  })
  return `Current date and time: ${now}\n\n${basePrompt}`
}

export interface AgentConfig {
  id: string
  handle: string
  systemPrompt: string
  model: string
  timezone?: string | undefined
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}
