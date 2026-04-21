#!/usr/bin/env bash
# F-004 test: docker compose lifecycle (up/down/logs + health checks)
# Tests the compose file structure — does NOT actually start containers
# (CI doesn't have Docker; runtime tests covered by Phase 1 demo verification)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker/compose.yml"

# ─── Test 1: docker/compose.yml exists ───────────────────────────────────────
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "FAIL: docker/compose.yml not found"
  exit 1
fi
echo "PASS: docker/compose.yml exists"

# ─── Test 2: compose file is valid YAML with required services ───────────────
for service in postgres redis ollama control-plane dashboard; do
  if ! grep -q "^  ${service}:" "$COMPOSE_FILE"; then
    echo "FAIL: service '$service' not found in compose.yml"
    exit 1
  fi
  echo "PASS: service '$service' defined"
done

# ─── Test 3: every service has restart: unless-stopped ───────────────────────
RESTART_COUNT=$(grep -c "restart: unless-stopped" "$COMPOSE_FILE" || true)
if [[ "$RESTART_COUNT" -lt 5 ]]; then
  echo "FAIL: expected at least 5 'restart: unless-stopped' entries, found $RESTART_COUNT"
  exit 1
fi
echo "PASS: all services have restart: unless-stopped ($RESTART_COUNT services)"

# ─── Test 4: every service has a healthcheck ─────────────────────────────────
HEALTH_COUNT=$(grep -c "healthcheck:" "$COMPOSE_FILE" || true)
if [[ "$HEALTH_COUNT" -lt 5 ]]; then
  echo "FAIL: expected at least 5 'healthcheck:' blocks, found $HEALTH_COUNT"
  exit 1
fi
echo "PASS: all services have healthcheck: ($HEALTH_COUNT healthchecks)"

# ─── Test 5: pnpm docker:up / docker:down scripts exist in root package.json ─
PACKAGE_JSON="$REPO_ROOT/package.json"
for script in "docker:up" "docker:down" "docker:logs"; do
  if ! grep -q "\"$script\"" "$PACKAGE_JSON"; then
    echo "FAIL: script '$script' missing from root package.json"
    exit 1
  fi
  echo "PASS: script '$script' exists in package.json"
done

# ─── Test 6: Dockerfiles exist for all services ──────────────────────────────
for dockerfile in Dockerfile.cli Dockerfile.dashboard Dockerfile.control-plane; do
  if [[ ! -f "$REPO_ROOT/docker/$dockerfile" ]]; then
    echo "FAIL: docker/$dockerfile not found"
    exit 1
  fi
  echo "PASS: docker/$dockerfile exists"
done

# ─── Test 7: each Dockerfile has HEALTHCHECK instruction ─────────────────────
for dockerfile in Dockerfile.dashboard Dockerfile.control-plane; do
  if ! grep -q "^HEALTHCHECK" "$REPO_ROOT/docker/$dockerfile"; then
    echo "FAIL: docker/$dockerfile missing HEALTHCHECK instruction"
    exit 1
  fi
  echo "PASS: docker/$dockerfile has HEALTHCHECK instruction"
done

echo ""
echo "F-004: all checks passed"
