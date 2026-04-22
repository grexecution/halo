import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: '0.1.0',
    agentCount: 0,
    activeGoals: 0,
    llmModel: process.env['OLLAMA_MODEL'] ?? 'ollama/llama3.2',
    uptime: process.uptime(),
  })
}
