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

BINARY_NAME="cyberpunk-${OS}-${ARCH}"
INSTALL_PATH="/usr/local/bin/cyberpunk"

echo ">> Downloading cyberpunk binary for ${OS}/${ARCH}..."

# Download the latest binary from GitHub Releases
curl -fsSL "https://github.com/kevin15011/cyberpunk-plugin/releases/latest/download/${BINARY_NAME}" \
  -o "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

echo "   Binary installed at ${INSTALL_PATH}"
echo ""

# Run the TUI to let the user choose what to install
echo ">> Launching cyberpunk TUI..."
cyberpunk
