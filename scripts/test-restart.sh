#!/usr/bin/env bash
# F-120 test: Docker restart policies
# Verifies every service in compose.yml has restart: unless-stopped.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker/compose.yml"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "FAIL: docker/compose.yml not found"
  exit 1
fi
echo "PASS: docker/compose.yml exists"

# Extract service names (lines like "  service-name:")
SERVICES=$(grep -E "^  [a-z][-a-z0-9]*:" "$COMPOSE_FILE" | sed 's/^ *//' | sed 's/://' | grep -v "^#")
echo "Services found: $SERVICES"

FAIL=0
while IFS= read -r service; do
  [[ -z "$service" ]] && continue
  # Check that restart: unless-stopped appears in the service block
  # Use awk to extract the service block and check for restart policy
  BLOCK=$(awk "/^  ${service}:/{found=1} found && /^  [a-z]/ && !/^  ${service}:/{found=0} found{print}" "$COMPOSE_FILE")
  if echo "$BLOCK" | grep -q "restart: unless-stopped"; then
    echo "PASS: $service has restart: unless-stopped"
  else
    echo "FAIL: $service missing restart: unless-stopped"
    FAIL=1
  fi
done <<< "$SERVICES"

if [[ "$FAIL" -eq 1 ]]; then
  echo ""
  echo "F-120: FAILED — some services missing restart policy"
  exit 1
fi

echo ""
echo "F-120: all services have restart: unless-stopped"
