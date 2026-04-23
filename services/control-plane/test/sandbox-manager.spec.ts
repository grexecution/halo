import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SandboxManager, Sandbox, globalSandboxManager } from '../src/sandbox-manager.js'

describe('SandboxManager (fake driver)', () => {
  let manager: SandboxManager

  beforeEach(() => {
    manager = new SandboxManager('fake')
  })

  afterEach(async () => {
    await manager.destroyAll()
  })

  it('creates a sandbox and tracks it', async () => {
    const sandbox = await manager.create()
    expect(sandbox).toBeInstanceOf(Sandbox)
    expect(sandbox.id).toBeTruthy()
    expect(manager.list()).toHaveLength(1)
    expect(manager.get(sandbox.id)).toBe(sandbox)
  })

  it('sandbox info reflects driver and creation time', async () => {
    const sandbox = await manager.create({ image: 'python:3.12-slim' })
    const info = sandbox.info()
    expect(info.driver).toBe('fake')
    expect(info.image).toBe('python:3.12-slim')
    expect(info.containerId).toBeTruthy()
    expect(info.createdAt).toBeInstanceOf(Date)
  })

  it('executes a command inside the sandbox', async () => {
    const sandbox = await manager.create()
    const result = await sandbox.exec('echo hello-from-sandbox')
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello-from-sandbox')
  })

  it('returns non-zero exit code for failing commands', async () => {
    const sandbox = await manager.create()
    const result = await sandbox.exec('exit 42')
    expect(result.exitCode).not.toBe(0)
  })

  it('destroy removes sandbox from tracking', async () => {
    const sandbox = await manager.create()
    await manager.destroy(sandbox.id)
    expect(manager.list()).toHaveLength(0)
    expect(manager.get(sandbox.id)).toBeUndefined()
  })

  it('destroyAll cleans up multiple sandboxes', async () => {
    await manager.create()
    await manager.create()
    await manager.create()
    expect(manager.list()).toHaveLength(3)
    await manager.destroyAll()
    expect(manager.list()).toHaveLength(0)
  })

  it('destroy is a no-op for unknown id', async () => {
    // should not throw
    await expect(manager.destroy('nonexistent-id')).resolves.toBeUndefined()
  })

  it('throws when exec called before start', async () => {
    // Create a raw Sandbox without starting it
    const sandbox = new Sandbox('fake', {
      memoryMb: 256,
      cpuShares: 512,
      network: false,
      timeoutMs: 5000,
      image: 'node:22-alpine',
    })
    await expect(sandbox.exec('echo test')).rejects.toThrow('not started')
  })
})

describe('globalSandboxManager', () => {
  it('is exported as a singleton SandboxManager', () => {
    expect(globalSandboxManager).toBeInstanceOf(SandboxManager)
  })
})
