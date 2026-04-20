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

# Check for ffmpeg (needed for sounds)
if ! command -v ffplay &> /dev/null; then
  echo ">> WARNING: ffmpeg not found — sound generation will fail."
  echo "   Install with: sudo apt install ffmpeg"
  echo ""
fi

# For Linux x64 and arm64, download pre-built binary from GitHub Releases
if [ "$OS" = "linux" ] && [ -f /etc/os-release ] && grep -qi "alpine\|musl" /etc/os-release 2>/dev/null; then
  echo ">> WARNING: Alpine Linux detected — downloading static binary..."
  OS="linux-musl"
fi

BINARY_NAME="cyberpunk-${OS}-${ARCH}"
INSTALL_PATH="./cyberpunk"
REPO="kevin15011/cyberpunk-plugin"

echo ">> Downloading cyberpunk binary for ${OS}/${ARCH}..."

# Download the latest binary from GitHub Releases
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"

if curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_PATH" 2>/dev/null; then
  chmod +x "$INSTALL_PATH"
  echo "   Binary installed at ${INSTALL_PATH}"
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
./cyberpunk tui