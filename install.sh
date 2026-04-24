#!/bin/bash
set -e

DETECTED_SHELL="sh"
DETECTED_PROFILE="~/.profile"
DETECTED_RELOAD_CMD="source ~/.profile"
PATH_EXPORT_LINE=""
PATH_STATUS="available"
FFMPEG_INSTALL_HINT=""
QUARANTINE_NOTE=""

detect_shell_profile() {
  local shell_name
  shell_name="$(basename "${SHELL:-sh}")"

  case "$shell_name" in
    zsh)
      DETECTED_SHELL="zsh"
      DETECTED_PROFILE="~/.zshrc"
      DETECTED_RELOAD_CMD="source ~/.zshrc"
      ;;
    bash)
      DETECTED_SHELL="bash"
      DETECTED_PROFILE="~/.bashrc"
      DETECTED_RELOAD_CMD="source ~/.bashrc"
      ;;
    fish)
      DETECTED_SHELL="fish"
      DETECTED_PROFILE="~/.config/fish/config.fish"
      DETECTED_RELOAD_CMD="exec fish"
      ;;
    *)
      DETECTED_SHELL="$shell_name"
      DETECTED_PROFILE="~/.profile"
      DETECTED_RELOAD_CMD="source ~/.profile"
      ;;
  esac
}

resolve_profile_path() {
  case "$1" in
    \~/*) printf '%s/%s\n' "$HOME" "${1#\~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

build_path_export_line() {
  if [ "$DETECTED_SHELL" = "fish" ]; then
    printf 'fish_add_path ~/.local/bin\n'
  else
    printf 'export PATH="$HOME/.local/bin:$PATH"\n'
  fi
}

path_already_exported() {
  local profile_path
  profile_path="$(resolve_profile_path "$1")"

  [ -f "$profile_path" ] || return 1

  grep -Fqx "$2" "$profile_path" && return 0

  if [ "$DETECTED_SHELL" = "fish" ]; then
    grep -Fqx 'fish_add_path ~/.local/bin' "$profile_path" && return 0
    grep -Fqx "fish_add_path ${INSTALL_DIR}" "$profile_path" && return 0
    return 1
  fi

  grep -Fqx 'export PATH="$HOME/.local/bin:$PATH"' "$profile_path" && return 0
  grep -Fqx "export PATH=\"${INSTALL_DIR}:\$PATH\"" "$profile_path" && return 0

  return 1
}

print_path_guidance() {
  case "$1" in
    available)
      echo ">> PATH ready: ${INSTALL_DIR_DISPLAY} is already available in this shell."
      ;;
    profile-present)
      echo ">> PATH export already exists in ${DETECTED_PROFILE}"
      echo "   Run: ${DETECTED_RELOAD_CMD}"
      ;;
    missing)
      echo ">> Add ${INSTALL_DIR_DISPLAY} to your PATH via ${DETECTED_PROFILE}"
      echo "   Add: ${PATH_EXPORT_LINE}"
      echo "   Run: ${DETECTED_RELOAD_CMD}"
      ;;
  esac
}

print_ffmpeg_guidance() {
  echo ">> NEXT STEP: ffmpeg is still required for sound generation features."

  if [ "$OS" = "darwin" ]; then
    FFMPEG_INSTALL_HINT="brew install ffmpeg"
  elif [ "$OS" = "linux" ] || [ "$OS" = "linux-musl" ]; then
    FFMPEG_INSTALL_HINT="sudo apt install ffmpeg"
  else
    FFMPEG_INSTALL_HINT="Install ffmpeg using your system package manager."
  fi

  echo "   Install with: ${FFMPEG_INSTALL_HINT}"
}

attempt_quarantine_removal() {
  local binary_path="$1"

  if [ "$OS" != "darwin" ]; then
    return 0
  fi

  if command -v xattr >/dev/null 2>&1; then
    if xattr -d com.apple.quarantine "$binary_path" >/dev/null 2>&1; then
      QUARANTINE_NOTE="Automatic quarantine removal succeeded."
      echo ">> macOS: Removed quarantine attribute from the downloaded binary."
    else
      QUARANTINE_NOTE="Automatic quarantine removal could not run. Manual fallback: xattr -d com.apple.quarantine ${binary_path}"
      echo ">> macOS: Automatic quarantine removal could not run"
      echo "   Manual fallback: xattr -d com.apple.quarantine ${binary_path}"
    fi
    return 0
  fi

  QUARANTINE_NOTE="Automatic quarantine removal could not run. Manual fallback: xattr -d com.apple.quarantine ${binary_path}"
  echo ">> macOS: Automatic quarantine removal could not run"
  echo "   Manual fallback: xattr -d com.apple.quarantine ${binary_path}"
}

print_install_summary() {
  local install_path="$1"
  local ffmpeg_present="$2"

  echo ""
  echo ">> INSTALL SUMMARY"
  echo "   Installed binary: ${install_path}"

  case "$PATH_STATUS" in
    available)
      echo "   PATH: ready in current shell"
      ;;
    profile-present)
      echo "   PATH: PATH export already exists in ${DETECTED_PROFILE}"
      echo "   Run: ${DETECTED_RELOAD_CMD}"
      ;;
    missing)
      echo "   PATH: Add ${INSTALL_DIR_DISPLAY} to your PATH via ${DETECTED_PROFILE}"
      echo "   Add: ${PATH_EXPORT_LINE}"
      echo "   Run: ${DETECTED_RELOAD_CMD}"
      ;;
  esac

  if [ "$ffmpeg_present" = "true" ]; then
    echo "   ffmpeg: detected"
  else
    echo "   Remaining action: install ffmpeg"
    echo "   Hint: ${FFMPEG_INSTALL_HINT}"
  fi

  if [ -n "$QUARANTINE_NOTE" ]; then
    echo "   macOS: ${QUARANTINE_NOTE}"
  fi

  echo "   Verify install: cyberpunk help"
}

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

if [ "$OS" = "darwin" ] && [ "$ARCH" = "x64" ]; then
  echo ">> macOS Intel is no longer provided as a pre-built binary target."
  echo "   Please build Cyberpunk from source on this machine:"
  echo ""
  echo "   git clone https://github.com/${REPO:-kevin15011/cyberpunk-plugin}.git"
  echo "   cd cyberpunk-plugin"
  echo "   bun install && bun run build"
  exit 1
fi

# For Linux x64 and arm64, download pre-built binary from GitHub Releases
if [ "$OS" = "linux" ] && [ -f /etc/os-release ] && grep -qi "alpine\|musl" /etc/os-release 2>/dev/null; then
  echo ">> WARNING: Alpine Linux detected — downloading static binary..."
  OS="linux-musl"
fi

BINARY_NAME="cyberpunk-${OS}-${ARCH}"
INSTALL_DIR="${HOME}/.local/bin"
INSTALL_DIR_DISPLAY="~/.local/bin"
INSTALL_PATH="${INSTALL_DIR}/cyberpunk"
REPO="kevin15011/cyberpunk-plugin"
FFMPEG_PRESENT="true"

if ! command -v ffplay >/dev/null 2>&1; then
  FFMPEG_PRESENT="false"
  print_ffmpeg_guidance
  echo ""
fi

echo ">> Downloading cyberpunk binary for ${OS}/${ARCH}..."

mkdir -p "$INSTALL_DIR"

# Download the latest binary from GitHub Releases
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"

if curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_PATH" 2>/dev/null; then
  chmod +x "$INSTALL_PATH"
  echo "   Binary installed at ${INSTALL_PATH}"

  attempt_quarantine_removal "$INSTALL_PATH"

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

  detect_shell_profile
  PATH_EXPORT_LINE="$(build_path_export_line)"

  case ":$PATH:" in
    *":${INSTALL_DIR}:"*) PATH_STATUS="available" ;;
    *)
      if path_already_exported "$DETECTED_PROFILE" "$PATH_EXPORT_LINE"; then
        PATH_STATUS="profile-present"
      else
        PATH_STATUS="missing"
      fi
      echo ""
      print_path_guidance "$PATH_STATUS"
      ;;
  esac

  print_install_summary "$INSTALL_PATH" "$FFMPEG_PRESENT"
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
