#!/usr/bin/env bash
# Verifies the vision service Python stubs exist with correct structure.
# Used for F-053, F-080, F-081, F-082 feature tests.
set -euo pipefail

VISION_SRC="services/vision-service/src/vision.py"

if [[ ! -f "$VISION_SRC" ]]; then
  echo "FAIL: $VISION_SRC not found" >&2
  exit 1
fi

for fn in describe ocr gui_act; do
  if ! grep -q "def $fn" "$VISION_SRC"; then
    echo "FAIL: vision.py missing function '$fn'" >&2
    exit 1
  fi
done

echo "PASS: vision service stubs verified (describe, ocr, gui_act)"
