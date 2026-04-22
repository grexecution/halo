import type { Rule } from 'eslint'

const TOOLS_PACKAGE = '@open-greg/tools'

export const noBypassPermission: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid direct tool handler calls that bypass the permission middleware',
    },
    messages: {
      noBypass:
        'Direct tool calls from @open-greg/tools must go through middleware.check(). Import from @open-greg/permissions and call middleware.check() first.',
    },
  },
  create(context) {
    const importedFromTools = new Set<string>()

    return {
      ImportDeclaration(node) {
        if (node.source.value === TOOLS_PACKAGE) {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier') {
              importedFromTools.add(spec.local.name)
            }
          }
        }
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && importedFromTools.has(node.callee.name)) {
          context.report({ node, messageId: 'noBypass' })
        }
      },
    }
  },
}
