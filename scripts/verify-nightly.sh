#!/usr/bin/env bash
# F-163: Verify the nightly workflow file exists and has correct schedule config
set -euo pipefail

NIGHTLY=".github/workflows/nightly.yml"

if [[ ! -f "$NIGHTLY" ]]; then
  echo "FAIL: $NIGHTLY not found"
  exit 1
fi

if ! grep -q "schedule:" "$NIGHTLY"; then
  echo "FAIL: nightly.yml missing schedule trigger"
  exit 1
fi

if ! grep -q "cron:" "$NIGHTLY"; then
  echo "FAIL: nightly.yml missing cron expression"
  exit 1
fi

if ! grep -q "test:features" "$NIGHTLY"; then
  echo "FAIL: nightly.yml does not run test:features"
  exit 1
fi

echo "PASS: nightly.yml is correctly configured"
