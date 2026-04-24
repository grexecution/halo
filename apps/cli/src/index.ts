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
  pollHealth,
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

// ── Rich progress display for docker compose up + health wait ─────────────────
//
// Renders a live block like:
//
//   ● Building Halo  [████████░░░░░░░░░░░░]  3m 12s
//
//   Stage 1 / 4  Compiling control-plane...
//   postgres    ✓ healthy
//   redis       ✓ healthy
//   control-plane  ⠸ starting...
//   dashboard      ░ waiting
//
// Uses raw ANSI cursor control so the block redraws in-place.
// Falls back gracefully if stdout is not a TTY.

const STAGES = [
  'Installing dependencies…',
  'Building control-plane image…',
  'Building dashboard image…',
  'Starting all services…',
]

const SERVICES = ['postgres', 'redis', 'ollama', 'litellm', 'control-plane', 'dashboard'] as const
type ServiceName = (typeof SERVICES)[number]

const BAR_WIDTH = 20

function renderBar(fraction: number): string {
  const filled = Math.round(fraction * BAR_WIDTH)
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

async function runWithProgress(repoDir: string, dashPort: number, cpPort: number): Promise<void> {
  const isTTY = process.stdout.isTTY
  const startMs = Date.now()

  // Track per-service status
  const svcStatus: Record<ServiceName, 'waiting' | 'building' | 'starting' | 'healthy' | 'error'> =
    {
      postgres: 'waiting',
      redis: 'waiting',
      ollama: 'waiting',
      litellm: 'waiting',
      'control-plane': 'waiting',
      dashboard: 'waiting',
    }

  let currentStage = 0
  let stageLabel = STAGES[0]!
  let lastLineCount = 0

  const svcIcon = (s: (typeof svcStatus)[ServiceName]) => {
    if (s === 'healthy') return '✓'
    if (s === 'error') return '✗'
    if (s === 'building' || s === 'starting') return '⠸'
    return '░'
  }

  const render = () => {
    if (!isTTY) return

    // Erase previous render
    if (lastLineCount > 0) {
      process.stdout.write(`\x1b[${lastLineCount}A\x1b[0J`)
    }

    const elapsed = Date.now() - startMs
    const fraction = Math.min(currentStage / STAGES.length, 0.99)
    const lines: string[] = [
      '',
      `  \x1b[1m● Building Halo\x1b[0m  [${renderBar(fraction)}]  ${fmtElapsed(elapsed)}`,
      '',
      `  Stage ${currentStage + 1} / ${STAGES.length}  ${stageLabel}`,
      '',
      ...SERVICES.map((svc) => {
        const icon = svcIcon(svcStatus[svc])
        const colour =
          svcStatus[svc] === 'healthy'
            ? '\x1b[32m'
            : svcStatus[svc] === 'error'
              ? '\x1b[31m'
              : '\x1b[33m'
        return `  ${colour}${icon}\x1b[0m  ${svc.padEnd(16)} ${svcStatus[svc]}`
      }),
      '',
    ]

    process.stdout.write(lines.join('\n'))
    lastLineCount = lines.length
  }

  // Kick off a render loop every second
  const interval = setInterval(render, 1000)
  render()

  // ── Phase 1–3: docker compose up --build ──────────────────────────────────
  const stagePatterns: Array<{ pattern: RegExp; stage: number; label: string; svc?: ServiceName }> =
    [
      { pattern: /Building|build/i, stage: 1, label: STAGES[1]! },
      {
        pattern: /control-plane.*build|Dockerfile\.control/i,
        stage: 1,
        label: STAGES[1]!,
        svc: 'control-plane',
      },
      {
        pattern: /dashboard.*build|Dockerfile\.dashboard/i,
        stage: 2,
        label: STAGES[2]!,
        svc: 'dashboard',
      },
      { pattern: /Starting|started|Created/i, stage: 3, label: STAGES[3]! },
      {
        pattern: /postgres.*start|postgres.*health/i,
        stage: 3,
        label: STAGES[3]!,
        svc: 'postgres',
      },
      { pattern: /redis.*start|redis.*health/i, stage: 3, label: STAGES[3]!, svc: 'redis' },
      { pattern: /ollama.*start/i, stage: 3, label: STAGES[3]!, svc: 'ollama' },
      { pattern: /litellm.*start/i, stage: 3, label: STAGES[3]!, svc: 'litellm' },
    ]

  try {
    await composeUp(repoDir, (line) => {
      // eslint-disable-next-line no-control-regex
      const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim()
      if (!clean) return

      // Non-TTY: just print the line
      if (!isTTY) {
        process.stdout.write(`  ${clean}\n`)
        return
      }

      // Advance stage based on output patterns
      for (const { pattern, stage, label, svc } of stagePatterns) {
        if (pattern.test(clean) && stage > currentStage) {
          currentStage = stage
          stageLabel = label
          if (svc) svcStatus[svc] = 'building'
        }
      }

      // Mark services as starting when "Started" appears
      if (/Started|Healthy/i.test(clean)) {
        for (const svc of SERVICES) {
          if (clean.toLowerCase().includes(svc) && svcStatus[svc] !== 'healthy') {
            svcStatus[svc] = 'starting'
          }
        }
      }

      render()
    })
  } catch (err) {
    clearInterval(interval)
    if (isTTY && lastLineCount > 0) {
      process.stdout.write(`\x1b[${lastLineCount}A\x1b[0J`)
    }
    log.error('Build failed. Last output:')
    log.message(String(err))
    log.info(`Full logs: docker compose -f ${repoDir}/docker/compose.yml logs --tail=80`)
    process.exit(1)
  }

  // ── Phase 4: wait for health ───────────────────────────────────────────────
  currentStage = 3
  stageLabel = 'Waiting for services to be ready…'

  const healthChecks: Array<{ svc: ServiceName; url: string }> = [
    { svc: 'postgres', url: `http://localhost:${cpPort}/health` }, // proxied via cp
    { svc: 'control-plane', url: `http://localhost:${cpPort}/health` },
    { svc: 'dashboard', url: `http://localhost:${dashPort}` },
  ]

  // Poll each service independently
  for (const { svc, url } of healthChecks) {
    svcStatus[svc] = 'starting'
    render()
    const ok = await pollHealth(url, { maxWaitMs: 180_000, intervalMs: 2000 })
    svcStatus[svc] = ok ? 'healthy' : 'error'
    if (!ok) {
      clearInterval(interval)
      if (isTTY && lastLineCount > 0) {
        process.stdout.write(`\x1b[${lastLineCount}A\x1b[0J`)
      }
      log.error(`${svc} did not become healthy within 3 minutes.`)
      log.info(`Check logs: docker compose -f ${repoDir}/docker/compose.yml logs --tail=50 ${svc}`)
      process.exit(1)
    }
    render()
  }

  // Mark remaining services healthy (postgres, redis, ollama, litellm started if compose succeeded)
  for (const svc of SERVICES) {
    if (svcStatus[svc] === 'waiting' || svcStatus[svc] === 'starting') {
      svcStatus[svc] = 'healthy'
    }
  }

  currentStage = STAGES.length
  stageLabel = 'All services healthy!'
  render()
  clearInterval(interval)

  // Final clean render with bar at 100%
  if (isTTY && lastLineCount > 0) {
    process.stdout.write(`\x1b[${lastLineCount}A\x1b[0J`)
  }
  const elapsed = fmtElapsed(Date.now() - startMs)
  process.stdout.write(
    [
      '',
      `  \x1b[1m● Halo is ready\x1b[0m  [${renderBar(1)}]  ${elapsed}`,
      '',
      ...SERVICES.map((svc) => `  \x1b[32m✓\x1b[0m  ${svc}`),
      '',
    ].join('\n'),
  )
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

  // ── Step 3: LLM — always Ollama on install ────────────────────────────────
  // No API key needed. Works offline. Switch to Anthropic/OpenAI any time
  // from the dashboard Settings → LLM provider.
  const llmProvider = 'ollama'
  const anthropicKey = ''
  const openaiKey = ''
  log.info(
    'Using local Ollama — ~2 GB model downloads on first chat. Change provider any time in Settings.',
  )

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
    await runWithProgress(REPO_DIR, 3000, 3001)
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
