# Open Decisions

_Unresolved questions. Check before making big assumptions. Resolve by editing this file + linking to the decision in a commit._

---

## D-01 — Project name

**Status:** unresolved
**Options:** `Marten`, `Ferrox`, `Caracal`, `Nullclaw`, something new.
**Why it matters:** affects npm name, repo, branding. Must not be "claw"-themed per user preference.
**Recommendation:** pick before Phase 1 publish, but fine to stay as `open-greg` internally until then.

## D-02 — License

**Status:** unresolved
**Options:** MIT / AGPL / Apache 2.0 / Elastic License.
**Why it matters:** MIT maximizes adoption; AGPL forces hosted forks to contribute back; Apache is middle ground.
**Recommendation:** MIT. The agency angle suggests optimizing for spread.

## D-03 — Monorepo vs multi-repo

**Status:** resolved → monorepo (pnpm workspace)
**Reasoning:** simpler to start, easier refactors, AGENTS.md works better in one tree.

## D-04 — Default system prompts for shipped agents

**Status:** stub written, needs review
**Owner:** Gregor to tune before Phase 2 exit.
**Location:** `packages/agent-core/src/default-prompts/*.md`.

## D-05 — OTel export default

**Status:** resolved → off by default
**Reasoning:** user toggles it on in settings. No data leaves the machine without explicit opt-in.
**Note:** config for `otel.bluemonkeys.at` is pre-populated but disabled.

## D-06 — Agent's ability to edit its own docs

**Status:** resolved → yes, gated
**Reasoning:** user explicitly asked for agent to edit `ARCHITECTURE.md` and `FEATURES.md` when behavior changes.
**Implementation:** a `docs.edit(file, changes)` tool gated behind `tools.docs_edit: true` in permissions. Default: true for main agent, false for sub-agents. Every edit creates a git commit with trace info.

## D-07 — How many sub-agents ship by default

**Status:** resolved → 5 (main, coder, email, researcher, critic)
**Reasoning:** covers the main user stories. More can be added via UI.

## D-08 — Windows support

**Status:** deferred to v2
**Reasoning:** WSL2 works for dev; native Windows adds significant test matrix. Out of scope for v1.

## D-09 — Multi-user / team support

**Status:** deferred to v2
**Reasoning:** v1 is single-user. Team features need auth, RBAC, shared memory scoping. Big surface.

## D-10 — Plugin marketplace / skill store

**Status:** deferred to v2
**Reasoning:** v1 has registry view + custom MCP add. A true marketplace is a product in itself.

## D-11 — Cloud-hosted variant

**Status:** deferred, possibly never
**Reasoning:** philosophy is self-host. Could happen in v2+ but is an explicit anti-goal in v1.

## D-12 — What triggers memory entity linking

**Status:** resolved → on every `memory.index` call
**Reasoning:** Mem0 does this automatically in its extraction pipeline. No extra work needed.

## D-13 — Python vs Node for voice/vision services

**Status:** resolved → Python
**Reasoning:** NeMo, Piper, PaddleOCR all have first-class Python APIs. Calling across process boundary is fine — both services are stateless HTTP.

## D-14 — Default agent timezone / locale

**Status:** needs implementation
**Owner:** wizard collects this. Store in `~/.open-greg/config.yml`.

---

_End of OPEN_DECISIONS.md._
