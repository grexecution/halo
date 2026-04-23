export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

export async function GET() {
  const db = getDb()

  const agentCount = (db.prepare('SELECT COUNT(*) as n FROM agents').get() as { n: number }).n

  const activeGoals = (
    db.prepare("SELECT COUNT(*) as n FROM goals WHERE status IN ('running', 'pending')").get() as {
      n: number
    }
  ).n

  const runningGoals = (
    db.prepare("SELECT COUNT(*) as n FROM goals WHERE status = 'running'").get() as { n: number }
  ).n

  return NextResponse.json({
    ok: true,
    version: '0.1.0',
    agentCount,
    activeGoals,
    runningGoals,
    llmModel: process.env['OLLAMA_MODEL'] ?? process.env['ANTHROPIC_MODEL'] ?? 'auto',
    uptime: process.uptime(),
  })
}
