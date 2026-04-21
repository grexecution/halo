#!/usr/bin/env bash
# Fail-fast rescue branch protocol (F-168).
# Usage: bash scripts/rescue.sh <reason-slug> "<summary>"
# Example: bash scripts/rescue.sh security-regression "Denied path became allowed in F-041"
#
# What it does:
#   1. Creates branch rescue/<date>-<reason>
#   2. Stages and commits any uncommitted work
#   3. Writes RESCUE.md with the summary and context
#   4. Commits RESCUE.md
#   5. Exits 1 so the calling process knows work has stopped
set -euo pipefail

REASON="${1:-unknown-reason}"
SUMMARY="${2:-No summary provided.}"
DATE="$(date +%Y-%m-%d)"
BRANCH="rescue/${DATE}-${REASON}"

# ─── Create rescue branch ────────────────────────────────────────────────────
git checkout -b "$BRANCH" 2>&1 || {
  echo "ERROR: could not create rescue branch $BRANCH" >&2
  exit 1
}
echo "Created branch: $BRANCH"

# ─── Stage any uncommitted work ──────────────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet || git status --short | grep -q '^?'; then
  git add -A
  git commit --allow-empty -m "rescue: stage uncommitted work before halt" 2>&1 || true
  echo "Staged and committed pending work"
fi

# ─── Write RESCUE.md ─────────────────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel)"
cat > "$REPO_ROOT/RESCUE.md" <<EOF
# RESCUE — ${DATE}

**Branch:** \`${BRANCH}\`
**Reason:** ${REASON}
**Date:** ${DATE}

## Summary

${SUMMARY}

## What happened

A fail-fast condition was triggered per \`docs/SELF_REPAIR.md#8\`.
Work has been halted. No further commits will be made on this branch
until a human reviews this file and either:

1. Merges the rescue branch (if work is salvageable)
2. Discards the rescue branch (if starting fresh is better)

## Context

See \`docs/SELF_REPAIR.md\` for the full list of fail-fast conditions.

## Next steps for the human reviewer

- Review all commits on this branch vs \`main\`
- Check the failing condition described above
- If the issue is fixable: fix it on a new branch from \`main\`, do NOT continue on this rescue branch
- Run \`pnpm -w run test\` and \`pnpm -w run lint\` to verify the fix before merging
EOF

git add "$REPO_ROOT/RESCUE.md"
git commit -m "rescue: write RESCUE.md and halt — ${REASON}"

echo ""
echo "Rescue branch created: $BRANCH"
echo "RESCUE.md written. Work halted per docs/SELF_REPAIR.md#8."
echo "Human intervention required before continuing."
exit 1
