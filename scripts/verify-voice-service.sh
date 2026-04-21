#!/usr/bin/env bash
# Verifies the voice service Python stubs exist with correct structure.
# Used for F-070, F-071, F-072, F-073 feature tests.
set -euo pipefail

VOICE_SRC="services/voice-service/src/voice.py"

if [[ ! -f "$VOICE_SRC" ]]; then
  echo "FAIL: $VOICE_SRC not found" >&2
  exit 1
fi

for fn in stt_local stt_cloud tts_local tts_cloud; do
  if ! grep -q "def $fn" "$VOICE_SRC"; then
    echo "FAIL: voice.py missing function '$fn'" >&2
    exit 1
  fi
done

echo "PASS: voice service stubs verified (stt_local, stt_cloud, tts_local, tts_cloud)"
