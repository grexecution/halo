/**
 * F-051: Filesystem read/write tool
 *
 * Verifies that files can be read, written, listed, and deleted.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync, rmSync } from 'node:fs'
import { fsRead, fsWrite, fsList, fsDelete } from '../src/fs.js'

const TEST_DIR = join(tmpdir(), 'open-greg-tools-test')
const TEST_FILE = join(TEST_DIR, 'test.txt')
const NESTED_FILE = join(TEST_DIR, 'nested', 'deep.txt')

afterAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
})

describe('F-051: Filesystem read/write tool', () => {
  it('writes a file and reads it back', () => {
    const writeResult = fsWrite({ path: TEST_FILE, content: 'hello world' })
    expect(writeResult.ok).toBe(true)

    const readResult = fsRead({ path: TEST_FILE })
    expect(readResult.ok).toBe(true)
    expect(readResult.content).toBe('hello world')
  })

  it('creates parent directories on write', () => {
    const result = fsWrite({ path: NESTED_FILE, content: 'deep content' })
    expect(result.ok).toBe(true)
    expect(existsSync(NESTED_FILE)).toBe(true)
  })

  it('returns error for nonexistent file', () => {
    const result = fsRead({ path: join(TEST_DIR, 'nonexistent.txt') })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('lists directory contents', () => {
    fsWrite({ path: join(TEST_DIR, 'a.txt'), content: 'a' })
    fsWrite({ path: join(TEST_DIR, 'b.txt'), content: 'b' })

    const result = fsList({ path: TEST_DIR })
    expect(result.ok).toBe(true)
    expect(result.entries).toBeDefined()
    const names = result.entries!.map((e) => e.name)
    expect(names).toContain('a.txt')
    expect(names).toContain('b.txt')
  })

  it('lists directory entry types correctly', () => {
    const result = fsList({ path: TEST_DIR })
    expect(result.ok).toBe(true)
    const nested = result.entries!.find((e) => e.name === 'nested')
    expect(nested?.type).toBe('dir')
    const file = result.entries!.find((e) => e.name === 'a.txt')
    expect(file?.type).toBe('file')
  })

  it('deletes a file', () => {
    const path = join(TEST_DIR, 'to-delete.txt')
    fsWrite({ path, content: 'bye' })
    expect(existsSync(path)).toBe(true)

    const result = fsDelete({ path })
    expect(result.ok).toBe(true)
    expect(existsSync(path)).toBe(false)
  })

  it('deletes a directory recursively', () => {
    const dir = join(TEST_DIR, 'to-delete-dir')
    fsWrite({ path: join(dir, 'file.txt'), content: 'inside' })
    expect(existsSync(dir)).toBe(true)

    const result = fsDelete({ path: dir, recursive: true })
    expect(result.ok).toBe(true)
    expect(existsSync(dir)).toBe(false)
  })

  it('overwrites existing file content', () => {
    fsWrite({ path: TEST_FILE, content: 'first' })
    fsWrite({ path: TEST_FILE, content: 'second' })
    const result = fsRead({ path: TEST_FILE })
    expect(result.content).toBe('second')
  })
})
