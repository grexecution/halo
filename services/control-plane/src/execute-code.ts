/**
 * F-206: execute_code tool
 *
 * Runs JS/TS-style code snippets in a Node.js vm.runInNewContext sandbox.
 * The sandbox has NO access to Node builtins (no require, no process, no fs).
 * Output is captured via a custom console.log shim injected into the context.
 *
 * Timeout is enforced by running the vm script inside a Promise race.
 */
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { Script, createContext } from 'node:vm'

// ---------------------------------------------------------------------------
// Core sandbox executor (exported for testing without the Mastra wrapper)
// ---------------------------------------------------------------------------

export type ExecuteCodeResult =
  | { ok: true; result: unknown; stdout: string }
  | { ok: true; result: unknown }
  | { ok: false; error: string; stdout: string }
  | { ok: false; error: string }

export async function runInSandbox(code: string, timeoutMs: number): Promise<ExecuteCodeResult> {
  return new Promise((resolve) => {
    const stdoutLines: string[] = []

    // Minimal sandbox — intentionally no Node APIs
    const sandbox = createContext({
      console: {
        log: (...args: unknown[]) => stdoutLines.push(args.map(String).join(' ')),
        warn: (...args: unknown[]) => stdoutLines.push('[warn] ' + args.map(String).join(' ')),
        error: (...args: unknown[]) => stdoutLines.push('[error] ' + args.map(String).join(' ')),
      },
      Math,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      Map,
      Set,
      Promise,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      undefined,
      null: null,
      // Explicitly NOT included: require, process, Buffer, __dirname, __filename
    })

    const getStdout = () => stdoutLines.join('\n')

    const okResult = (val: unknown): ExecuteCodeResult => {
      const out = getStdout()
      return out ? { ok: true, result: val, stdout: out } : { ok: true, result: val }
    }

    const errResult = (msg: string): ExecuteCodeResult => {
      const out = getStdout()
      return out ? { ok: false, error: msg, stdout: out } : { ok: false, error: msg }
    }

    // Timeout via setTimeout + resolve
    const timer = setTimeout(() => {
      resolve(errResult('Execution timed out'))
    }, timeoutMs)

    let script: Script
    try {
      // Compile separately so syntax errors are caught before execution
      script = new Script(code, { filename: 'sandbox.js' })
    } catch (err) {
      clearTimeout(timer)
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) })
      return
    }

    try {
      // runInContext returns the last evaluated expression value
      const result = script.runInContext(sandbox, { timeout: timeoutMs })
      clearTimeout(timer)

      // If result is a Promise, wait for it (up to remaining timeout)
      if (result instanceof Promise) {
        result
          .then((val) => resolve(okResult(val)))
          .catch((err: unknown) => {
            resolve(errResult(String(err instanceof Error ? err.message : err)))
          })
      } else {
        resolve(okResult(result))
      }
    } catch (err) {
      clearTimeout(timer)
      const msg = err instanceof Error ? err.message : String(err)
      const isTimeout = msg.includes('timed out') || msg.includes('Script execution timed out')
      resolve(errResult(isTimeout ? 'Execution timed out' : msg))
    }
  })
}

// ---------------------------------------------------------------------------
// Mastra tool wrapper
// ---------------------------------------------------------------------------

export const executeCodeTool = createTool({
  id: 'execute_code',
  description:
    'Run a JavaScript code snippet in an isolated sandbox. No access to Node builtins. Returns the last expression value and any console.log output.',
  inputSchema: z.object({
    code: z.string().describe('JavaScript code to execute'),
    timeout: z
      .number()
      .int()
      .positive()
      .max(30_000)
      .optional()
      .default(5000)
      .describe('Timeout in milliseconds (max 30s, default 5s)'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    result: z.unknown().optional(),
    stdout: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ code, timeout = 5000 }) => {
    return runInSandbox(code, timeout)
  },
})
