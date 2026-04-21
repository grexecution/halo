type Tier = 'weak' | 'mid' | 'strong'

interface TierConfig {
  name: Tier
  model: string
  size: string
}

interface InstallResult {
  success: boolean
  model: string
  tier: Tier
}

interface LocalLLMOptions {
  dryRun?: boolean | undefined
}

const TIERS: TierConfig[] = [
  { name: 'weak', model: 'llama3.2:3b', size: '3B' },
  { name: 'mid', model: 'qwen2.5:14b', size: '14B' },
  { name: 'strong', model: 'qwen2.5:32b', size: '32B' },
]

export class LocalLLMInstaller {
  private dryRun: boolean

  constructor(opts: LocalLLMOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  getTiers(): TierConfig[] {
    return TIERS
  }

  async install(tier: Tier, onProgress?: (pct: number) => void): Promise<InstallResult> {
    if (!this.dryRun) {
      throw new Error('Real install requires Ollama — use dryRun: true for tests')
    }

    const config = TIERS.find((t) => t.name === tier)
    if (!config) throw new Error(`Unknown tier: ${tier}`)

    // Simulate progress
    if (onProgress) {
      for (const pct of [0, 25, 50, 75, 100]) {
        onProgress(pct)
      }
    }

    return { success: true, model: config.model, tier }
  }
}
