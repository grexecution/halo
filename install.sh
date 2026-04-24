#!/usr/bin/env bash
set -euo pipefail

# ── Non-interactive detection ─────────────────────────────────────────────────
# If env vars are set, run fully non-interactively (no TTY needed).
# Otherwise, re-exec from a real TTY so arrow-key prompts work.
NON_INTERACTIVE=0
if [ -n "${ANTHROPIC_API_KEY:-}" ] || [ -n "${OPENAI_API_KEY:-}" ] || [ "${HALO_CI:-}" = "1" ]; then
  NON_INTERACTIVE=1
elif [ ! -t 0 ]; then
  TMP=$(mktemp /tmp/halo-install-XXXXXX.sh)
  curl -fsSL "https://raw.githubusercontent.com/grexecution/halo/main/install.sh" -o "$TMP"
  chmod +x "$TMP"
  exec bash "$TMP" "$@"
fi

REPO="https://github.com/grexecution/halo"
INSTALL_DIR="${HALO_DIR:-$HOME/halo}"

echo ""
echo "  Halo — self-hosted AI agent"
echo "  =============================="
echo ""

# ── Node 22 ───────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.split(".")[0].replace("v",""))')" -lt 22 ]]; then
  echo "→ Installing Node.js 22..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
  elif command -v brew &>/dev/null; then
    brew install node@22 >/dev/null 2>&1
  else
    echo "  Could not install Node automatically. Install Node 22 manually: https://nodejs.org"
    exit 1
  fi
  echo "  ✓ Node $(node --version)"
else
  echo "  ✓ Node $(node --version)"
fi

# ── Build tools ───────────────────────────────────────────────────────────────
if command -v apt-get &>/dev/null; then
  if ! dpkg -s build-essential &>/dev/null 2>&1; then
    echo "→ Installing build tools..."
    sudo apt-get update -qq && sudo apt-get install -y -qq build-essential python3 curl git >/dev/null 2>&1
    echo "  ✓ Build tools ready"
  fi
fi

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
  sudo usermod -aG docker "$USER" || true
  # Apply group without logout
  if ! docker info >/dev/null 2>&1; then
    echo "  ✓ Docker installed (you may need to log out and back in if this is a fresh server)"
    # Try with newgrp for current session
    exec newgrp docker bash "$0" "$@" 2>/dev/null || true
  fi
  echo "  ✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
else
  echo "  ✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# ── pnpm ──────────────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "→ Installing pnpm..."
  npm install -g pnpm >/dev/null 2>&1
  echo "  ✓ pnpm $(pnpm --version)"
else
  echo "  ✓ pnpm $(pnpm --version)"
fi

# ── Clone / update repo ───────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "→ Updating Halo..."
  git -C "$INSTALL_DIR" pull --ff-only >/dev/null 2>&1
else
  echo "→ Cloning Halo..."
  git clone "$REPO" "$INSTALL_DIR" >/dev/null 2>&1
fi
echo "  ✓ Halo source at $INSTALL_DIR"

# ── Install deps ──────────────────────────────────────────────────────────────
echo "→ Installing dependencies..."
pnpm install --dir "$INSTALL_DIR" >/dev/null 2>&1
echo "  ✓ Dependencies ready"

echo ""
echo "  Starting setup..."
echo ""

# ── Run CLI wizard ────────────────────────────────────────────────────────────
cd "$INSTALL_DIR/apps/cli"

if [ "$NON_INTERACTIVE" = "1" ]; then
  CLAW_NON_INTERACTIVE=1 npx tsx src/index.ts
else
  npx tsx src/index.ts
fi
