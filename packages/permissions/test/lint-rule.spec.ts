/**
 * F-045: Non-bypassable middleware lint rule
 * Verifies that the custom ESLint rule catches direct tool handler calls
 * that skip the permission middleware.
 */
import { describe, it, expect } from 'vitest'
import { RuleTester } from 'eslint'
import { noBypassPermission } from '../src/lint-rule.js'

describe('F-045: no-bypass-permission lint rule', () => {
  const tester = new RuleTester({
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  })

  it('rejects direct tool handler calls not going through middleware', () => {
    expect(() => {
      tester.run('no-bypass-permission', noBypassPermission, {
        valid: [],
        invalid: [
          {
            code: `import { shellExec } from '@claw-alt/tools';\nshellExec({ cmd: 'ls' });`,
            errors: [{ messageId: 'noBypass' }],
          },
        ],
      })
    }).not.toThrow()
  })

  it('allows calls that go through the middleware check', () => {
    expect(() => {
      tester.run('no-bypass-permission', noBypassPermission, {
        valid: [
          {
            code: `import { middleware } from '@claw-alt/permissions';\nawait middleware.check('shell_exec', { cmd: 'ls' }, ctx);`,
          },
          {
            // Non-tool code is fine
            code: `const x = 1 + 2;`,
          },
        ],
        invalid: [],
      })
    }).not.toThrow()
  })
})
