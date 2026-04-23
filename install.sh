#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/grexecution/halo"
INSTALL_DIR="$HOME/halo"

echo ""
echo "  Halo — self-hosted AI agent"
echo "  =============================="
echo ""

# ── Node 22 ──────────────────────────────────────────────────────────────────
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

# ── Docker ───────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker..."
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
  sudo usermod -aG docker "$USER" || true
  echo "  ✓ Docker installed"
else
  echo "  ✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# ── pnpm ─────────────────────────────────────────────────────────────────────
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

# ── Install deps ─────────────────────────────────────────────────────────────
echo "→ Installing dependencies..."
pnpm install --dir "$INSTALL_DIR" >/dev/null 2>&1
echo "  ✓ Dependencies ready"

echo ""
echo "  Starting setup wizard..."
echo ""

# ── Run wizard ────────────────────────────────────────────────────────────────
cd "$INSTALL_DIR/apps/cli"
npx tsx src/index.ts
