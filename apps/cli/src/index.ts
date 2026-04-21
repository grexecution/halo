import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { intro, outro, log } from '@clack/prompts'
import { runWizard } from './wizard.js'

const CLAW_CONFIG_DIR =
  process.env['CLAW_CONFIG_DIR'] ?? resolve(homedir(), '.claw-alt')
const CONFIG_PATH = resolve(CLAW_CONFIG_DIR, 'config.yml')

function generatePassphrase(): string {
  return randomBytes(32).toString('hex')
}

function showHelp(): void {
  process.stdout.write(
    `create-claw-alt — bootstrap a self-hosted AI agent platform

USAGE
  npx create-claw-alt init [options]   set up a new instance
  npx create-claw-alt --help           show this help

OPTIONS (init)
  --non-interactive    skip prompts, use defaults / env vars
  --print-passphrase   print a generated CLAW_SECRET_PASSPHRASE and exit
  --llm-provider <p>   anthropic | openai | ollama  (default: anthropic)
  --dashboard-port <n> dashboard port (default: 3000)
  --cp-port <n>        control-plane port (default: 3001)

ENVIRONMENT
  CLAW_NON_INTERACTIVE=1    same as --non-interactive
  CLAW_SECRET_PASSPHRASE    pre-set passphrase for headless Linux
  CLAW_CONFIG_DIR           override ~/.claw-alt config directory
`,
  )
}

async function cmdInit(args: string[]): Promise<void> {
  const nonInteractive =
    args.includes('--non-interactive') || process.env['CLAW_NON_INTERACTIVE'] === '1'
  const printPassphrase = args.includes('--print-passphrase')

  if (printPassphrase) {
    const pp = process.env['CLAW_SECRET_PASSPHRASE'] ?? generatePassphrase()
    process.stdout.write(pp + '\n')
    return
  }

  const llmProviderIdx = args.indexOf('--llm-provider')
  const llmProvider = llmProviderIdx !== -1 ? args[llmProviderIdx + 1] : undefined

  const dashPortIdx = args.indexOf('--dashboard-port')
  const dashboardPort =
    dashPortIdx !== -1 ? Number(args[dashPortIdx + 1]) : undefined

  const cpPortIdx = args.indexOf('--cp-port')
  const controlPlanePort =
    cpPortIdx !== -1 ? Number(args[cpPortIdx + 1]) : undefined

  if (!nonInteractive) {
    intro('create-claw-alt')
    log.info('Interactive wizard not yet implemented. Use --non-interactive for Phase 1.')
    outro('Done.')
    return
  }

  const cfg = await runWizard({
    nonInteractive: true,
    configPath: CONFIG_PATH,
    llmProvider,
    dashboardPort,
    controlPlanePort,
  })

  if (nonInteractive) {
    process.stdout.write(
      `Config written to ${CONFIG_PATH}\n` +
        `  llm_provider: ${cfg.llm_provider}\n` +
        `  dashboard_port: ${cfg.dashboard_port}\n` +
        `  control_plane_port: ${cfg.control_plane_port}\n`,
    )
  }
}

export async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  if (!command || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  if (command === 'init') {
    await cmdInit(args)
    return
  }

  process.stderr.write(`Unknown command: ${command}\n`)
  showHelp()
  process.exit(1)
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${String(err)}\n`)
  process.exit(1)
})
