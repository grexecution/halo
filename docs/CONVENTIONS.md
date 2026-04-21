# Code Conventions

_Rules that are specific to this repo. For generic best-practices, trust your tools (ESLint, Prettier, tsc) — we don't repeat them here._

---

## Language & runtime

- **TypeScript everywhere** in Node services. Python only in `services/voice-service` and `services/vision-service` (ML-heavy).
- **Node 22 LTS.** No features newer than this.
- **ESM modules.** No CommonJS. `"type": "module"` in every package.json.
- **Strict TS:** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.

## Imports & exports

- **Named exports, never default.** Easier to refactor, better IDE navigation.
- Import from package root, not deep paths: `import { X } from '@claw-alt/shared'` not `'@claw-alt/shared/src/types/x'`.

## Naming

- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Types/interfaces: `PascalCase`. Use `type` by default; `interface` only when you need declaration merging.
- Functions and variables: `camelCase`. Constants: `SCREAMING_SNAKE_CASE`.
- Feature IDs: `F-NNN`. Phase IDs: `P-N`. Reference them in commits.

## Errors

- Throw `Error` subclasses with stable names. No strings.
- Every tool handler returns `{ ok: true, value } | { ok: false, error }`. No thrown errors across tool boundaries.
- Wrap external calls (LLM, MCP, HTTP) with retry+timeout via `p-retry`. Default: 3 attempts, exponential backoff, 30s timeout.

## Logging

- Use pino, structured. No `console.log` in committed code (lint-enforced).
- Every log line has `trace_id`, `agent_id` (if applicable), `tool_id` (if applicable).
- Use levels: `error` (user-visible failure), `warn` (recoverable), `info` (lifecycle), `debug` (dev only).

## Validation

- Every external input (HTTP body, tool args, env vars) validated via zod.
- Share schemas between client and server via `packages/shared`.

## Tool handlers

Every tool handler:
```ts
export const myTool = defineTool({
  id: 'my.tool',
  description: 'Does X.',
  schema: z.object({ ... }),
  permissions_required: ['scope.action'],
  handler: async (args, ctx) => { ... },
});
```
Never export raw handlers. Registration only via `defineTool`, which the middleware wraps automatically.

## Database

- Drizzle ORM. All queries typed.
- Migrations generated, never hand-edited after commit.
- No cross-service writes to the same table. Each service owns a subset.

## Commits & branches

- Branches: `<phase>/<feature-id>-<slug>`. Example: `p3/F-023-telegram-group-routing`.
- Commits: `<phase>/<feature-id>: <imperative summary>`. Example: `p3/F-023: route @handle mentions to sub-agents`.
- Signed commits preferred.
- Squash-merge PRs.

## Tests

- Vitest for TS. Pytest for Python.
- Unit tests co-located: `foo.ts` + `foo.spec.ts`.
- Integration tests in `test/` at package root.
- Feature tests referenced in `docs/FEATURES.md` are the source of truth for "does this work end-to-end."

## Comments

- Code should be self-documenting. Comments explain *why*, never *what*.
- No commented-out code in commits.
- `TODO` without an associated feature row or issue number fails lint.

## Don't

- Don't use `any`. If you need an escape hatch, use `unknown` + a zod parse.
- Don't bypass the permission middleware. Ever.
- Don't `console.log` in committed code.
- Don't hardcode secrets — use env vars or the keychain.
- Don't import Node built-ins unprefixed (`node:fs` not `fs`).
- Don't install dependencies with <1k GitHub stars and no recent activity.
- Don't mix concerns in tRPC routers — one domain per router.

---

_End of CONVENTIONS.md._
