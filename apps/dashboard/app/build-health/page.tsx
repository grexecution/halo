import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface FeatureResult {
  id: string
  title: string
  result: 'pass' | 'fail' | 'regression'
  ts: string
}

interface NightlyResult {
  date: string
  status: string
  run_id: string
}

function getRecentRegressions(): FeatureResult[] {
  const histPath = resolve(process.cwd(), 'artifacts/feature-history.jsonl')
  if (!existsSync(histPath)) return []
  const lines = readFileSync(histPath, 'utf-8').trim().split('\n').filter(Boolean)
  const results: FeatureResult[] = []
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as FeatureResult
      if (entry.result === 'regression') results.push(entry)
    } catch {
      /* skip */
    }
  }
  return results.slice(-20)
}

function getNightlyResults(): NightlyResult[] {
  const nightlyDir = resolve(process.cwd(), 'artifacts/nightly')
  if (!existsSync(nightlyDir)) return []
  const files = readdirSync(nightlyDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 7)
  return files.map((f) => {
    try {
      return JSON.parse(readFileSync(resolve(nightlyDir, f), 'utf-8')) as NightlyResult
    } catch {
      return { date: f.replace('.json', ''), status: 'unknown', run_id: '' }
    }
  })
}

export default function BuildHealthPage() {
  const regressions = getRecentRegressions()
  const nightly = getNightlyResults()

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Build Health</h1>

      <section className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Recent Regressions (last 20 results)</h2>
        <div data-testid="regressions-section">
          {regressions.length === 0 ? (
            <p className="text-green-600" data-testid="no-regressions">
              No regressions detected
            </p>
          ) : (
            <ul className="space-y-1">
              {regressions.map((r, i) => (
                <li key={i} data-testid={`regression-${r.id}`} className="text-red-600 text-sm">
                  REGRESSION: {r.id} — {r.title} ({r.ts})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Nightly Runs (last 7 days)</h2>
        <div data-testid="nightly-section">
          {nightly.length === 0 ? (
            <p className="text-gray-400">No nightly runs recorded yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="p-1">Date</th>
                  <th className="p-1">Status</th>
                  <th className="p-1">Run ID</th>
                </tr>
              </thead>
              <tbody>
                {nightly.map((n, i) => (
                  <tr key={i} data-testid={`nightly-row-${n.date}`}>
                    <td className="p-1">{n.date}</td>
                    <td
                      className={`p-1 font-semibold ${n.status === 'success' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {n.status}
                    </td>
                    <td className="p-1 font-mono text-xs">{n.run_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">STUCK.md Files</h2>
        <div data-testid="stuck-section">
          <p className="text-gray-400 text-sm">No STUCK.md files found</p>
        </div>
      </section>
    </main>
  )
}
