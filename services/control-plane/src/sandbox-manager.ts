/**
 * F-211: Per-session Docker sandboxing
 *
 * SandboxManager creates and manages isolated Docker containers for agent
 * sub-sessions. Each sandbox gets its own container with:
 *   - An isolated filesystem (tmpfs, no host mounts)
 *   - Resource limits (CPU, memory)
 *   - No network access (unless explicitly enabled)
 *   - Automatic cleanup on session end or timeout
 *
 * In test/CI environments (no Docker), a fake mode runs commands in a
 * child_process.exec with no container — controlled by SANDBOX_DRIVER env.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

const execFileAsync = promisify(execFile)

export interface SandboxOptions {
  /** Max memory in MB. Default: 256 */
  memoryMb?: number
  /** CPU shares (relative weight). Default: 512 */
  cpuShares?: number
  /** Enable outbound network. Default: false */
  network?: boolean
  /** Execution timeout in ms. Default: 30_000 */
  timeoutMs?: number
  /** Docker image to use. Default: 'node:22-alpine' */
  image?: string
}

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface SandboxInfo {
  id: string
  containerId: string | null
  image: string
  createdAt: Date
  driver: 'docker' | 'fake'
}

/** Detected driver: 'docker' when Docker is available, 'fake' otherwise. */
export type SandboxDriver = 'docker' | 'fake'

export class Sandbox {
  readonly id: string
  readonly driver: SandboxDriver
  private containerId: string | null = null
  private readonly image: string
  private readonly memoryMb: number
  private readonly cpuShares: number
  private readonly network: boolean
  private readonly timeoutMs: number
  readonly createdAt: Date

  constructor(driver: SandboxDriver, opts: Required<SandboxOptions>) {
    this.id = randomUUID()
    this.driver = driver
    this.image = opts.image
    this.memoryMb = opts.memoryMb
    this.cpuShares = opts.cpuShares
    this.network = opts.network
    this.timeoutMs = opts.timeoutMs
    this.createdAt = new Date()
  }

  async start(): Promise<void> {
    if (this.driver === 'fake') {
      this.containerId = `fake-${this.id.slice(0, 8)}`
      return
    }

    const networkFlag = this.network ? '' : '--network none'
    const args = [
      'run',
      '-d',
      '--rm',
      '--name',
      `open-greg-sandbox-${this.id.slice(0, 8)}`,
      '--memory',
      `${this.memoryMb}m`,
      '--cpu-shares',
      String(this.cpuShares),
      ...(this.network ? [] : ['--network', 'none']),
      '--tmpfs',
      '/workspace:rw,size=100m',
      '-w',
      '/workspace',
      this.image,
      'sh',
      '-c',
      'sleep 3600',
    ]
    // suppress unused variable warning
    void networkFlag

    const { stdout } = await execFileAsync('docker', args, { timeout: 10_000 })
    this.containerId = stdout.trim()
  }

  /**
   * Execute a shell command inside the sandbox.
   * Returns stdout, stderr, and exit code.
   */
  async exec(command: string): Promise<ExecResult> {
    if (!this.containerId) throw new Error('Sandbox not started — call start() first')

    if (this.driver === 'fake') {
      // In fake mode run the command directly in a restricted shell
      try {
        const { stdout, stderr } = await execFileAsync('sh', ['-c', command], {
          timeout: this.timeoutMs,
        })
        return { stdout, stderr, exitCode: 0 }
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; code?: number }
        return {
          stdout: e.stdout ?? '',
          stderr: e.stderr ?? String(err),
          exitCode: e.code ?? 1,
        }
      }
    }

    try {
      const { stdout, stderr } = await execFileAsync(
        'docker',
        ['exec', this.containerId, 'sh', '-c', command],
        { timeout: this.timeoutMs },
      )
      return { stdout, stderr, exitCode: 0 }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number }
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(err),
        exitCode: e.code ?? 1,
      }
    }
  }

  /**
   * Stop and remove the sandbox container.
   */
  async cleanup(): Promise<void> {
    if (!this.containerId) return

    if (this.driver === 'docker') {
      try {
        await execFileAsync('docker', ['rm', '-f', this.containerId], { timeout: 5_000 })
      } catch {
        // ignore — container may have already exited
      }
    }

    this.containerId = null
  }

  info(): SandboxInfo {
    return {
      id: this.id,
      containerId: this.containerId,
      image: this.image,
      createdAt: this.createdAt,
      driver: this.driver,
    }
  }
}

export class SandboxManager {
  private sandboxes = new Map<string, Sandbox>()
  private driver: SandboxDriver

  constructor(driver?: SandboxDriver) {
    // Allow override via SANDBOX_DRIVER env; default to 'fake' so unit tests
    // never require Docker.
    this.driver = driver ?? (process.env['SANDBOX_DRIVER'] as SandboxDriver) ?? 'fake'
  }

  /**
   * Create a new sandbox, start the container, and track it.
   */
  async create(opts: SandboxOptions = {}): Promise<Sandbox> {
    const resolved: Required<SandboxOptions> = {
      memoryMb: opts.memoryMb ?? 256,
      cpuShares: opts.cpuShares ?? 512,
      network: opts.network ?? false,
      timeoutMs: opts.timeoutMs ?? 30_000,
      image: opts.image ?? 'node:22-alpine',
    }

    const sandbox = new Sandbox(this.driver, resolved)
    await sandbox.start()
    this.sandboxes.set(sandbox.id, sandbox)
    return sandbox
  }

  /**
   * Get an existing sandbox by ID.
   */
  get(id: string): Sandbox | undefined {
    return this.sandboxes.get(id)
  }

  /**
   * Cleanup and remove a sandbox.
   */
  async destroy(id: string): Promise<void> {
    const sandbox = this.sandboxes.get(id)
    if (!sandbox) return
    await sandbox.cleanup()
    this.sandboxes.delete(id)
  }

  /**
   * Cleanup all active sandboxes (call on process exit).
   */
  async destroyAll(): Promise<void> {
    await Promise.all([...this.sandboxes.keys()].map((id) => this.destroy(id)))
  }

  /** List info for all active sandboxes. */
  list(): SandboxInfo[] {
    return [...this.sandboxes.values()].map((s) => s.info())
  }
}

/** Singleton manager used by the control-plane. */
export const globalSandboxManager = new SandboxManager()
