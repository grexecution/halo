/**
 * create-open-greg — interactive setup CLI
 *
 * Usage:
 *   npx create-open-greg          # interactive (default)
 *   npx create-open-greg --ci     # non-interactive, defaults only
 */
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import {
  intro,
  outro,
  text,
  select,
  confirm,
  spinner,
  note,
  log,
  isCancel,
  cancel,
} from '@clack/prompts'
import { runWizard } from './wizard.js'
import {
  isDockerAvailable,
  isDockerComposeAvailable,
  getDockerInstallInstructions,
  writeEnvFile,
  composeUp,
  waitForServices,
} from './setup.js'
import { startTunnel } from './tunnel.js'

const DATA_DIR = process.env['GREG_DATA_DIR'] ?? resolve(homedir(), '.open-greg')
const CONFIG_PATH = resolve(DATA_DIR, 'config.yml')
const REPO_DIR = resolve(new URL(import.meta.url).pathname, '..', '..', '..', '..')

function bail(msg: string): never {
  cancel(msg)
  process.exit(1)
}

function randomAdminPassword(): string {
  // 3 chunks of 4 random chars — easy to type, hard to guess
  const chunk = () => randomBytes(2).toString('hex')
  return `${chunk()}-${chunk()}-${chunk()}`
}

async function promptOrDefault<T>(
  nonInteractive: boolean,
  promptFn: () => Promise<T | symbol>,
  defaultVal: T,
): Promise<T> {
  if (nonInteractive) return defaultVal
  const val = await promptFn()
  if (isCancel(val)) bail('Setup cancelled.')
  return val as T
}

async function cmdInit(args: string[]): Promise<void> {
  const nonInteractive =
    args.includes('--ci') ||
    args.includes('--non-interactive') ||
    process.env['GREG_CI'] === '1' ||
    process.env['CLAW_NON_INTERACTIVE'] === '1'

  // --print-passphrase: generate + print a secret passphrase and exit (used by tests)
  if (args.includes('--print-passphrase')) {
    const passphrase = randomBytes(32).toString('hex')
    process.stdout.write(passphrase + '\n')
    return
  }

  intro('  Halo — self-hosted AI agent  ')

  // ── Step 0: Docker check ──────────────────────────────────────────────────
  const sp = spinner()
  sp.start('Checking Docker...')

  const dockerAvailable = isDockerAvailable()
  const composeAvailable = dockerAvailable && isDockerComposeAvailable()

  if (!dockerAvailable) {
    sp.stop('Docker not found.')
    if (!nonInteractive) {
      note(getDockerInstallInstructions(), 'Docker is required')
      bail('Please install Docker and re-run this command.')
    }
    log.warn('Docker not found — skipping Docker steps in non-interactive mode.')
  } else if (!composeAvailable) {
    sp.stop('docker compose not found.')
    if (!nonInteractive) {
      bail(
        '"docker compose" plugin not found. Run: docker plugin install compose (or update Docker Desktop).',
      )
    }
    log.warn('docker compose not found — skipping Docker steps in non-interactive mode.')
  } else {
    sp.stop('Docker is ready.')
  }

  // ── Step 1: Existing install? ─────────────────────────────────────────────
  const hasExisting = existsSync(CONFIG_PATH)
  if (hasExisting && !nonInteractive) {
    const overwrite = await confirm({
      message: 'Existing Halo install found. Reconfigure it?',
      initialValue: false,
    })
    if (isCancel(overwrite) || !overwrite)
      bail('Keeping existing install. Run again to reconfigure.')
  }

  // ── Step 2: Public URL or local-only? ─────────────────────────────────────
  const accessMode = await promptOrDefault(
    nonInteractive,
    () =>
      select({
        message: 'How do you want to access the dashboard?',
        options: [
          {
            value: 'tunnel',
            label: 'Public URL  (Cloudflare Tunnel — free, no account needed)',
            hint: 'Access from any device, works behind NAT',
          },
          {
            value: 'local',
            label: 'Local only  (localhost:3000)',
            hint: 'You manage port forwarding yourself',
          },
        ],
      }),
    'tunnel' as string,
  )

  const enableTunnel = accessMode === 'tunnel'

  // ── Step 3: LLM provider ──────────────────────────────────────────────────
  const llmProvider = await promptOrDefault(
    nonInteractive,
    () =>
      select({
        message: 'Which LLM do you want to use?',
        options: [
          {
            value: 'anthropic',
            label: 'Anthropic Claude  (recommended)',
            hint: 'Best quality — needs an API key',
          },
          {
            value: 'openai',
            label: 'OpenAI GPT',
            hint: 'Needs an API key',
          },
          {
            value: 'ollama',
            label: 'Local Ollama  (free, runs on your machine)',
            hint: 'Needs 8+ GB RAM — slower first run',
          },
        ],
      }),
    'anthropic' as string,
  )

  let anthropicKey = ''
  let openaiKey = ''

  if (llmProvider === 'anthropic') {
    const key = await promptOrDefault(
      nonInteractive,
      () =>
        text({
          message: 'Anthropic API key:',
          placeholder: 'sk-ant-...',
          validate: (v) =>
            v.trim().startsWith('sk-ant-') ? undefined : 'Should start with sk-ant-',
        }),
      process.env['ANTHROPIC_API_KEY'] ?? '',
    )
    anthropicKey = key.trim()
  } else if (llmProvider === 'openai') {
    const key = await promptOrDefault(
      nonInteractive,
      () =>
        text({
          message: 'OpenAI API key:',
          placeholder: 'sk-...',
          validate: (v) => (v.trim().startsWith('sk-') ? undefined : 'Should start with sk-'),
        }),
      process.env['OPENAI_API_KEY'] ?? '',
    )
    openaiKey = key.trim()
  } else {
    log.info('Ollama selected — model will be downloaded on first use (~2 GB). This is fine.')
  }

  // ── Step 4: Admin password ────────────────────────────────────────────────
  const defaultPass = randomAdminPassword()
  const adminPassword = await promptOrDefault(
    nonInteractive,
    () =>
      text({
        message: 'Choose a dashboard admin password (or press Enter to use the generated one):',
        placeholder: defaultPass,
        defaultValue: defaultPass,
      }),
    defaultPass,
  )

  // ── Step 5: Confirm & go ──────────────────────────────────────────────────
  if (!nonInteractive) {
    const proceed = await confirm({ message: 'Ready to start. Pull images and launch? (~1–3 min)' })
    if (isCancel(proceed) || !proceed) bail('Aborted.')
  }

  // ── Write config + .env ───────────────────────────────────────────────────
  await runWizard({
    nonInteractive: true,
    configPath: CONFIG_PATH,
    llmProvider,
    dashboardPort: 3000,
    controlPlanePort: 3001,
  })

  writeEnvFile({
    dataDir: DATA_DIR,
    repoDir: REPO_DIR,
    adminPassword,
    enableTunnel,
    dashboardPort: 3000,
    cpPort: 3001,
    ...(anthropicKey ? { anthropicKey } : {}),
    ...(openaiKey ? { openaiKey } : {}),
  })

  if (dockerAvailable && composeAvailable) {
    // ── docker compose up ───────────────────────────────────────────────────
    const up = spinner()
    up.start('Starting services (pulling images on first run — this may take a few minutes)...')

    try {
      await composeUp(REPO_DIR, (line) => {
        // Only surface lines that look meaningful
        if (line.includes('Pulling') || line.includes('Started') || line.includes('Error')) {
          up.message(line.slice(0, 80))
        }
      })
    } catch (err) {
      up.stop('docker compose failed.')
      bail(String(err))
    }

    up.stop('Containers started.')

    // ── Wait for health ─────────────────────────────────────────────────────
    const hsp = spinner()
    hsp.start('Waiting for services to be ready...')

    try {
      await waitForServices(3000, 3001, (msg) => hsp.message(msg))
    } catch (err) {
      hsp.stop('Services did not start in time.')
      log.error(String(err))
      log.info('Check logs with: docker compose -f docker/compose.yml logs --tail=50')
      process.exit(1)
    }

    hsp.stop('Services ready.')
  } else if (nonInteractive) {
    log.info('Skipping Docker startup (non-interactive, no Docker available).')
  }

  // ── Cloudflare Tunnel ─────────────────────────────────────────────────────
  let publicUrl = `http://localhost:3000`

  if (enableTunnel && dockerAvailable && composeAvailable) {
    const tsp = spinner()
    tsp.start('Starting Cloudflare Tunnel...')
    try {
      const tunnel = await startTunnel(3000, (msg) => tsp.message(msg))
      publicUrl = tunnel.url
      tsp.stop(`Tunnel active: ${publicUrl}`)
      // Keep the tunnel alive — process stays running
      process.on('SIGINT', () => {
        tunnel.stop()
        process.exit(0)
      })
      process.on('SIGTERM', () => {
        tunnel.stop()
        process.exit(0)
      })
    } catch (err) {
      tsp.stop('Tunnel failed — falling back to local URL.')
      log.warn(String(err))
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  note(
    [
      `Dashboard URL:    ${publicUrl}`,
      `Admin password:   ${adminPassword}`,
      '',
      'Open the URL and finish setup in the dashboard',
      '(connect Telegram, tune your agent, start chatting).',
      '',
      enableTunnel
        ? 'Keep this terminal open to maintain the public URL.'
        : 'Close this terminal any time — services run in Docker.',
    ].join('\n'),
    'Halo is running',
  )

  if (!enableTunnel) {
    outro('Done. Run again any time to reconfigure.')
  }
  // If tunnel: process stays alive intentionally
}

function showHelp(): void {
  process.stdout.write(
    `create-open-greg — set up a self-hosted AI agent

USAGE
  npx create-open-greg        interactive setup (default)
  npx create-open-greg --ci   non-interactive, use defaults / env vars

ENV VARS (for --ci mode)
  ANTHROPIC_API_KEY    pre-fill Anthropic key
  OPENAI_API_KEY       pre-fill OpenAI key
  GREG_ADMIN_PASSWORD  pre-set admin password
  GREG_DATA_DIR        override ~/.open-greg data directory
  GREG_CI=1            same as --ci
`,
  )
}

export async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  if (command === '--help' || command === '-h') {
    showHelp()
    return
  }

  // Default command is init; also accept explicit "init"
  const isCi = command === '--ci' || process.env['GREG_CI'] === '1'
  const allArgs = command === 'init' ? args : [command ?? '', ...args]
  await cmdInit(isCi ? ['--ci', ...allArgs] : allArgs)
}

main().catch((err: unknown) => {
  process.stderr.write(`\nFatal: ${String(err)}\n`)
  process.exit(1)
})
