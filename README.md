# Cyberpunk Environment for OpenCode + Tmux

A self-installing cyberpunk theme + sound pack for [opencode](https://opencode.ai) and tmux. One command to get your full cyberpunk setup on any machine.

## What's included

### OpenCode Plugin
- **Cyberpunk theme** — Dark backgrounds, neon pink/cyan/green accents, syntax highlighting
- **4 custom sounds** — Generated with ffmpeg on first run (no audio files to ship)
  - `idle` — Dark/dystopia tone when a task completes
  - `error` — Low descending tone on session errors
  - `compact` — Neural compression sound on context compaction
  - `permission` — Alert beep when opencode asks for permission
- **SDD Integration** — Patches SDD prompts/skills to wire the `apply → Judgment Day review gate → verify` flow. This is now a separate component from the sound plugin for clean separation of concerns.
- **RTK** (optional) — Token-optimized CLI proxy that filters verbose command outputs before they reach your LLM context. Installs `rtk`, runs `rtk init -g --opencode`, and adds instruction reinforcement.
- **TUI Plugins** — Registers `opencode-sdd-engram-manage` and `opencode-subagent-statusline` in `tui.json` for enhanced TUI experience.
- **Codebase Memory MCP** — Auto-downloads `codebase-memory-mcp` binary, adds MCP config for structural code exploration (call graphs, symbols, routes). Routing instructions enforce read-before-edit workflow.
- **Configurable SDD review** — `sdd-review` uses the model you select from your configured OpenCode providers/models.
- **Automatic context-mode bootstrap** — Ensures `context-mode` MCP/plugin config, routing instructions, and SDD prompt defaults exist after OpenCode/Gentle AI updates
- **Cross-platform** — macOS (`afplay`) and Linux/WSL (`paplay`)

### Components

| Component | Flag | Description |
|-----------|------|-------------|
| **OpenCode Event Sounds** | `--plugin` | Cyberpunk theme + 4 generated sounds (idle, error, compact, permission) |
| **Theme** | `--theme` | Dark cyberpunk TUI color scheme |
| **Sounds** | `--sounds` | Sound effect WAV files (requires `ffmpeg`) |
| **SDD Integration** | `--sdd-integration` | Patches SDD prompts/skills with the Judgment Day review gate before verify. Separated from the sound plugin for clean separation of concerns. |
| **Context Mode** | `--context-mode` | MCP plugin + routing instructions for context protection |
| **RTK** | `--rtk` | Token-optimized CLI proxy |
| **Tmux** | `--tmux` | Cyberpunk HUD status bar + vim keybindings |
| **TUI Plugins** | `--tui-plugins` | Registers opencode TUI plugins |
| **Codebase Memory** | `--codebase-memory` | Auto-downloads `codebase-memory-mcp`, adds MCP config |

### Tmux Config
- **Cyberpunk HUD** — Neon status bar with CPU, RAM, git branch, clock
- **Vim keybindings** — `Ctrl-a` prefix, `h/j/k/l` pane navigation, `|/-` splits
- **Plugins** — TPM, resurrect, continuum, gitmux, tmux-cpu, tmux-yank
- **Vi mode** — Copy mode with vi keys

## Install (everything)

```bash
curl -fsSL https://raw.githubusercontent.com/kevin15011/cyberpunk-plugin/main/install.sh | bash
```

This downloads the binary from the latest GitHub Release, installs it to `~/.local/bin/cyberpunk`, prints shell-aware PATH guidance when needed, shows a short verification summary (`cyberpunk help`), and then launches the installer TUI.

Pre-built binaries are published for Linux (`x64`, `arm64`) and macOS (`arm64`) using the shared `cyberpunk-{os}-{arch}` asset naming convention.

If `~/.local/bin` is not already in your `PATH`, the script prints shell-aware PATH guidance that points to the likely profile file (`~/.zshrc`, `~/.bashrc`, or `~/.config/fish/config.fish`) plus the reload command to apply it.

### Linux notes

- Pre-built Linux binaries are published for **x64** and **arm64**.
- WSL is supported through the same Linux assets and runtime path. There is no separate WSL binary or preset-specific build.
- Install ffmpeg before using sound generation features. Use your distro package manager, for example: `sudo apt install ffmpeg`, `sudo dnf install ffmpeg`, or `sudo pacman -S ffmpeg`.
- Event sound playback uses `paplay`, usually provided by PulseAudio/PipeWire packages. Examples: `sudo apt install pulseaudio-utils`, `sudo dnf install pulseaudio-utils`, or `sudo pacman -S libpulse`.
- On WSL, `paplay` may also require Windows/WSLg audio bridging to be available. If sound playback is missing, `cyberpunk doctor` reports it as advisory instead of blocking plugin use.

### macOS notes

- Pre-built macOS binaries are currently published for **Apple Silicon (`arm64`) only**. Intel Mac users should build from source.
- The installer attempts to remove the quarantine attribute automatically after download. If that step cannot run, use: `xattr -d com.apple.quarantine ~/.local/bin/cyberpunk`
- If macOS still blocks the first launch because the binary is unsigned, use Finder → right-click `cyberpunk` → **Open** once, then confirm the prompt.
- Install ffmpeg before using sound generation features: `brew install ffmpeg`

## Verifying downloads

### Presets

The installer supports presets that bundle common component combinations:

| Preset | Components |
|--------|-----------|
| `minimal` | Plugin, SDD Integration |
| `token-saver-general` | Plugin, SDD Integration, Theme, Context Mode |
| `token-saver-dev` | Plugin, SDD Integration, Theme, Context Mode, Codebase Memory, TUI Plugins |
| `developer-toolkit` | Plugin, SDD Integration, Theme, Context Mode, Codebase Memory, TUI Plugins, RTK, Tmux |
| `cyberpunk-full` | All supported components, including explicit aesthetic components |

> **Deprecated preset names**: `full`, `wsl`, and `mac` still work but emit deprecation warnings. Migrate to `cyberpunk-full`, `developer-toolkit`, and `developer-toolkit` respectively.

Every release publishes a `checksums.txt` asset alongside the platform binaries. After downloading the binary you want, verify it with:

```bash
sha256sum -c checksums.txt
```

Make sure the binary filename in your working directory matches the corresponding line in `checksums.txt`.

**Alternative**: Clone and build from source (for unsupported platforms or local development):
```bash
git clone https://github.com/kevin15011/cyberpunk-plugin.git
cd cyberpunk-plugin
bun install && bun run build
./cyberpunk tui
```

Then restart opencode. The plugin will auto-configure on first load, install both review phases, and re-bootstrap `context-mode` integration if OpenCode or Gentle AI updates overwrite those files. SDD integration patching is handled by the separate `sdd-integration` component.

Installation and SDD patch notices are silent by default so they do not clutter the OpenCode UI every time you open it. If you want to debug the setup flow, launch OpenCode with `OPENCODE_CYBERPUNK_INSTALL_NOTICES=1`.

## What the plugin now re-applies automatically

- Ensures `opencode.json` contains:
  - `mcp.context-mode`
  - `plugin: ["context-mode"]`
  - `instructions` entry for routing awareness
- Ensures `~/.config/opencode/instructions/context-mode-routing.md` exists
- Appends a small `context-mode` default block to `sdd-*.md` prompt files when missing
- Re-patches inline `sdd-*` agent prompts in `opencode.json` when they do not already mention `context-mode`

This is intentionally idempotent: if Gentle AI updates re-generate SDD prompts or agent config, loading the Cyberpunk plugin restores the missing `context-mode` glue without overwriting unrelated customizations.

## Install (opencode plugin only)

```bash
mkdir -p ~/.config/opencode/plugins
curl -o ~/.config/opencode/plugins/cyberpunk.ts https://raw.githubusercontent.com/kevin15011/cyberpunk-plugin/main/cyberpunk.ts
```

## Install (tmux config only)

The cyberpunk CLI can manage your tmux config non-destructively using marker-managed blocks. Only the cyberpunk-owned section of `~/.tmux.conf` is modified; any personal tmux settings are preserved.

```bash
cyberpunk install --tmux
```

This inserts the cyberpunk tmux configuration between `# cyberpunk-managed:start` / `# cyberpunk-managed:end` markers in `~/.tmux.conf`. To remove only the cyberpunk block:

```bash
cyberpunk uninstall --tmux
```

### TPM and plugins

`cyberpunk install --tmux` now makes a **best-effort** TPM bootstrap after writing the managed tmux block. When `git` is available and `~/.tmux/plugins/tpm` is missing, the CLI tries to clone TPM and run its plugin install script automatically.

This bootstrap step is advisory-only:

- your managed `~/.tmux.conf` block is kept even if TPM clone or plugin install fails
- unmanaged tmux content is never modified
- no active tmux session reload is attempted automatically

If you want to remove only the cyberpunk block later:

```bash
cyberpunk uninstall --tmux
```

If automatic bootstrap cannot complete, troubleshoot with:

```bash
cyberpunk doctor --tmux
cyberpunk doctor --fix --tmux
```

Common advisory cases:

- `git` missing → install `git`, then re-run `cyberpunk install --tmux` or `cyberpunk doctor --fix --tmux`
- TPM clone failure → re-run once network/auth access to GitHub works again
- TPM script missing/failing → run TPM manually if your local checkout uses different helper paths

Manual fallback remains:

```bash
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
~/.tmux/plugins/tpm/bin/install_plugins all
```

Run `cyberpunk doctor` to check the status of TPM, plugin readiness, gitmux, and other optional tmux dependencies.

## Requirements

- [opencode](https://opencode.ai)
- **Linux x64/arm64** — Pre-built binary available via curl install
- **macOS arm64** — Pre-built binary available via curl install
- **macOS Intel (x64)** — Build from source
- **Linux/WSL playback** — `paplay` via PulseAudio/PipeWire tools (`pulseaudio-utils` or distro equivalent)
- **macOS playback** — `afplay` (included with macOS)
- `ffmpeg` — Needed for sound generation (`sudo apt install ffmpeg`, `sudo dnf install ffmpeg`, `sudo pacman -S ffmpeg`, or `brew install ffmpeg`)
- `npm` — Needed for `context-mode` component
- `curl` — Needed for `rtk` and `codebase-memory` components
- `git` — For TPM installation
- [bun](https://bun.sh) — Only needed if building from source

## Current macOS limitations

macOS is supported with verified upgrade integrity. The following limitations apply:

- **Verified upgrade path**: Binary upgrades verify SHA256 checksums against published `checksums.txt`, run a smoke test before replacement, and attempt automatic quarantine removal. If any verification step fails, the existing binary is left unchanged.
- **Unsigned binaries**: macOS binaries are currently unsigned. Gatekeeper may block first launch. Use Finder → right-click → Open to bypass, or run `xattr -d com.apple.quarantine ~/.local/bin/cyberpunk`.
- **Signing and notarization deferred**: Code signing and Apple notarization are explicitly deferred to a future release and are not part of the current audited support scope.
- **Doctor diagnostics**: Run `cyberpunk doctor` on macOS to see readiness checks for quarantine handling, unsigned-binary expectations, and deferred items.

## Upgrade integrity verification

Binary upgrades (`installMode: "binary"`) include multi-step verification before replacing the existing binary:

1. **Checksum verification**: The downloaded binary is verified against the SHA256 hash published in `checksums.txt` for the matching platform asset. If the hash doesn't match, the upgrade is rejected and the existing binary is left unchanged.
2. **Smoke test**: The downloaded binary is run with `--help` to verify it can execute on the current platform. If it fails, the upgrade is rejected.
3. **Quarantine handling** (macOS only): On macOS, the upgrade attempts to remove the `com.apple.quarantine` extended attribute before replacing the existing binary. If this fails, manual guidance is provided and the upgrade is rejected.
4. **Atomic replacement**: The existing binary is only replaced after all verification steps pass. On any failure, the temporary download is cleaned up.

## Optional: Permission sound

To hear the permission alert sound, add this to your `opencode.json`:

```json
{
  "permission": {
    "bash": "ask"
  }
}
```

## Uninstall

```bash
cyberpunk uninstall --all
# Or individually:
cyberpunk uninstall --plugin
cyberpunk uninstall --sdd-integration
cyberpunk uninstall --theme
cyberpunk uninstall --sounds
cyberpunk uninstall --tmux
cyberpunk uninstall --tui-plugins
cyberpunk uninstall --codebase-memory
rm -f ~/.local/bin/cyberpunk
# Optional: remove RTK routing instructions
rm -f ~/.config/opencode/instructions/rtk-routing.md
```

## Security notes

- **Shell profile modifications** use marker-managed blocks — only cyberpunk-owned sections are added/removed
- **MCP configurations** are additive — existing entries in `opencode.json` are preserved
- **Binary downloads** use HTTPS from official GitHub releases

## Keybindings (tmux)

| Key | Action |
|-----|--------|
| `Ctrl-a` | Prefix |
| `prefix \|` | Split horizontal |
| `prefix -` | Split vertical |
| `prefix h/j/k/l` | Navigate panes |
| `prefix H/J/K/L` | Resize panes |
| `prefix r` | Reload config |
