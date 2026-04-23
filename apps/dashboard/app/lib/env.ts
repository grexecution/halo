/** Centralised env-var constants for the dashboard.
 *  Every route/module that needs these should import from here — never
 *  inline `process.env['...'] ?? 'default'` across the codebase.
 */

export const CONTROL_PLANE_URL = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

export const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434'
export const OLLAMA_DEFAULT_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2'

export const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'] ?? ''
export const ANTHROPIC_DEFAULT_MODEL = process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5-20251001'
