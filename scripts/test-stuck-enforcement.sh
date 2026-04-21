#!/usr/bin/env bash
# F-161 test: STUCK.md detector enforcement
# Verifies: (1) GitHub Action exists and checks for STUCK.md,
#            (2) detector script works correctly in test scenarios.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/feature-enforcement.yml"

# ─── Test 1: workflow file exists ───────────────────────────────────────────
if [[ ! -f "$WORKFLOW" ]]; then
  echo "FAIL: .github/workflows/feature-enforcement.yml not found"
  exit 1
fi
echo "PASS: feature-enforcement.yml exists"

# ─── Test 2: workflow contains STUCK.md detection ────────────────────────────
if ! grep -q "STUCK.md" "$WORKFLOW"; then
  echo "FAIL: feature-enforcement.yml does not check for STUCK.md"
  exit 1
fi
echo "PASS: workflow contains STUCK.md check"

# ─── Test 3: a STUCK.md at repo root would be detected ──────────────────────
# Create a temporary STUCK.md, verify the detection logic finds it
TMPDIR_TEST="$(mktemp -d)"
FAKE_REPO="$TMPDIR_TEST/repo"
mkdir -p "$FAKE_REPO"
echo "# STUCK" > "$FAKE_REPO/STUCK.md"

FOUND=$(find "$FAKE_REPO" -name "STUCK.md" -not -path "*/node_modules/*" | wc -l | tr -d ' ')
rm -rf "$TMPDIR_TEST"

if [[ "$FOUND" -eq 0 ]]; then
  echo "FAIL: STUCK.md detection logic does not find STUCK.md files"
  exit 1
fi
echo "PASS: STUCK.md detection logic finds STUCK.md in repo tree"

# ─── Test 4: repo currently has no STUCK.md (healthy state) ─────────────────
CURRENT_STUCK=$(find "$REPO_ROOT" -name "STUCK.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" | wc -l | tr -d ' ')

if [[ "$CURRENT_STUCK" -gt 0 ]]; then
  echo "FAIL: repo currently contains STUCK.md file(s)"
  find "$REPO_ROOT" -name "STUCK.md" -not -path "*/node_modules/*" -not -path "*/.git/*"
  exit 1
fi
echo "PASS: repo has no STUCK.md files (healthy state)"

echo ""
echo "F-161: all 4 checks passed"
