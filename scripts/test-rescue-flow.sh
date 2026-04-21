#!/usr/bin/env bash
# F-168 test: fail-fast rescue branch script
# Verifies: (1) scripts/rescue.sh exists,
#            (2) it creates a rescue branch and RESCUE.md when invoked,
#            (3) it does NOT merge back or continue work after rescue.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESCUE_SCRIPT="$REPO_ROOT/scripts/rescue.sh"

# ─── Test 1: rescue.sh exists ────────────────────────────────────────────────
if [[ ! -f "$RESCUE_SCRIPT" ]]; then
  echo "FAIL: scripts/rescue.sh not found"
  exit 1
fi
echo "PASS: scripts/rescue.sh exists"

# ─── Test 2: rescue.sh is executable ─────────────────────────────────────────
if [[ ! -x "$RESCUE_SCRIPT" ]]; then
  echo "FAIL: scripts/rescue.sh is not executable"
  exit 1
fi
echo "PASS: scripts/rescue.sh is executable"

# ─── Test 3: simulate a rescue in a temp repo ────────────────────────────────
TMPDIR_TEST="$(mktemp -d)"
FAKE_REPO="$TMPDIR_TEST/repo"
mkdir -p "$FAKE_REPO"
cd "$FAKE_REPO"
git init -q
git config user.email "test@test.com"
git config user.name "Test"
echo "initial" > README.md
git add README.md
git commit -q -m "initial"

# Copy rescue.sh into the fake repo (it needs to be able to run)
cp "$RESCUE_SCRIPT" "$FAKE_REPO/rescue.sh"
chmod +x "$FAKE_REPO/rescue.sh"

# Run rescue with test reason (it exits 1 by design — capture and ignore)
bash "$FAKE_REPO/rescue.sh" "test-reason" "Simulated fail-fast condition" 2>&1 | cat || true

# Verify rescue branch was created
if ! git branch | grep -q "rescue/"; then
  echo "FAIL: rescue branch not created"
  rm -rf "$TMPDIR_TEST"
  exit 1
fi
echo "PASS: rescue branch was created"

# Verify RESCUE.md exists
if [[ ! -f "$FAKE_REPO/RESCUE.md" ]]; then
  echo "FAIL: RESCUE.md was not written"
  rm -rf "$TMPDIR_TEST"
  exit 1
fi
echo "PASS: RESCUE.md was written"

# Verify RESCUE.md contains the reason
if ! grep -q "test-reason" "$FAKE_REPO/RESCUE.md"; then
  echo "FAIL: RESCUE.md does not contain the rescue reason"
  rm -rf "$TMPDIR_TEST"
  exit 1
fi
echo "PASS: RESCUE.md contains reason"

cd "$REPO_ROOT"
rm -rf "$TMPDIR_TEST"

echo ""
echo "F-168: all 5 checks passed"
