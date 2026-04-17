#!/bin/bash
set -e

echo ">> CYBERPUNK ENVIRONMENT INSTALLER"
echo ""

# --- OpenCode Plugin ---
echo ">> Installing opencode plugin..."
mkdir -p ~/.config/opencode/plugins
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/cyberpunk.ts" ~/.config/opencode/plugins/cyberpunk.ts
echo "   Plugin installed at ~/.config/opencode/plugins/cyberpunk.ts"

OBS_PLUGIN=~/.config/opencode/plugins/opencode-observability.ts
if [ -f "$OBS_PLUGIN" ]; then
  mv "$OBS_PLUGIN" "$OBS_PLUGIN.disabled"
  echo "   Disabled noisy plugin at ~/.config/opencode/plugins/opencode-observability.ts"
fi

# --- Tmux Config ---
echo ">> Installing tmux config..."
if [ -f ~/.tmux.conf ]; then
  BACKUP=~/.tmux.conf.bak.$(date +%Y%m%d%H%M%S)
  cp ~/.tmux.conf "$BACKUP"
  echo "   Existing config backed up to $BACKUP"
fi
cp "$SCRIPT_DIR/tmux.conf" ~/.tmux.conf
echo "   Config installed at ~/.tmux.conf"

# --- TPM (Tmux Plugin Manager) ---
if [ ! -d ~/.tmux/plugins/tpm ]; then
  echo ">> Installing TPM (Tmux Plugin Manager)..."
  git clone -q https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
  echo "   TPM installed"
else
  echo ">> TPM already installed, skipping"
fi

# --- Install tmux plugins ---
echo ">> Installing tmux plugins..."
~/.tmux/plugins/tpm/bin/install_plugins all 2>/dev/null || true
echo "   Plugins installed"

echo ""
echo ">> ALL SYSTEMS ONLINE // Cyberpunk environment ready"
echo "   - Restart opencode or run: tmux source-file ~/.tmux.conf"
