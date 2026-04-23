#!/bin/bash
set -e

echo ">> CYBERPUNK ENVIRONMENT INSTALLER"
echo ""

# Detect OS and architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

# Normalize arch names
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
esac

# For Linux x64 and arm64, download pre-built binary from GitHub Releases
if [ "$OS" = "linux" ] && [ -f /etc/os-release ] && grep -qi "alpine\|musl" /etc/os-release 2>/dev/null; then
  echo ">> WARNING: Alpine Linux detected — downloading static binary..."
  OS="linux-musl"
fi

# Check for ffmpeg (needed for sounds)
if ! command -v ffplay &> /dev/null; then
  echo ">> WARNING: ffmpeg not found — sound generation will fail."

  if [ "$OS" = "darwin" ]; then
    echo "   Install with: brew install ffmpeg"
  elif [ "$OS" = "linux" ] || [ "$OS" = "linux-musl" ]; then
    echo "   Install with: sudo apt install ffmpeg"
  else
    echo "   Install ffmpeg using your system package manager."
  fi

  echo ""
fi

BINARY_NAME="cyberpunk-${OS}-${ARCH}"
INSTALL_DIR="${HOME}/.local/bin"
INSTALL_PATH="${INSTALL_DIR}/cyberpunk"
REPO="kevin15011/cyberpunk-plugin"

echo ">> Downloading cyberpunk binary for ${OS}/${ARCH}..."

mkdir -p "$INSTALL_DIR"

# Download the latest binary from GitHub Releases
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"

if curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_PATH" 2>/dev/null; then
  chmod +x "$INSTALL_PATH"
  echo "   Binary installed at ${INSTALL_PATH}"

  # Persist installMode: "binary" in cyberpunk config
  # This ensures 'cyberpunk upgrade' knows to use the binary upgrade path
  # Uses the installed CLI itself — no dependency on bun/node availability

  if ! "$INSTALL_PATH" config init; then
    echo ">> ERROR: Failed to initialize cyberpunk config."
    echo "   Binary install mode could not be persisted."
    echo "   Try running manually: $INSTALL_PATH config init"
    exit 1
  fi

  if ! "$INSTALL_PATH" config installMode binary; then
    echo ">> ERROR: Failed to persist installMode=binary in config."
    echo "   Binary upgrades will not work correctly."
    echo "   Try running manually: $INSTALL_PATH config installMode binary"
    exit 1
  fi

  # Verify persistence succeeded
  STORED_MODE="$("$INSTALL_PATH" config installMode 2>/dev/null)" || true
  if [ "$STORED_MODE" != "binary" ]; then
    echo ">> ERROR: installMode persistence verification failed."
    echo "   Expected 'binary', got: '${STORED_MODE:-<empty>}'"
    echo "   Binary upgrades will not work correctly."
    echo "   Please report this issue at: https://github.com/${REPO}/issues"
    exit 1
  fi

  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      echo ""
      echo ">> NOTE: ${INSTALL_DIR} is not in your PATH yet."
      echo "   Add this line to your shell profile and restart the shell:"
      echo "   export PATH=\"${INSTALL_DIR}:\$PATH\""
      ;;
  esac
else
  echo ">> ERROR: Failed to download binary for ${OS}/${ARCH}."
  echo "   Please report this issue at: https://github.com/${REPO}/issues"
  echo ""
  echo "   Alternatively, you can build from source:"
  echo "   git clone https://github.com/${REPO}.git"
  echo "   cd cyberpunk-plugin"
  echo "   bun install && bun run build"
  exit 1
fi

# Run the TUI to let the user choose what to install
echo ""
echo ">> Launching cyberpunk TUI..."
"$INSTALL_PATH" tui
