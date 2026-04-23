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
- **RTK** (optional) — Token-optimized CLI proxy that filters verbose command outputs before they reach your LLM context. Installs `rtk`, runs `rtk init -g --opencode`, and adds instruction reinforcement.
- **2 custom SDD review phases** — `sdd-review` (native model review) and `sdd-claude-review` (Claude Opus CLI review)
- **Automatic SDD patching** — Registers review agents in `opencode.json` and patches `/sdd-continue` to `apply -> review -> verify`
- **Automatic context-mode bootstrap** — Ensures `context-mode` MCP/plugin config, routing instructions, and SDD prompt defaults exist after OpenCode/Gentle AI updates
- **Cross-platform** — macOS (`afplay`) and Linux (`ffplay`)

### Tmux Config
- **Cyberpunk HUD** — Neon status bar with CPU, RAM, git branch, clock
- **Vim keybindings** — `Ctrl-a` prefix, `h/j/k/l` pane navigation, `|/-` splits
- **Plugins** — TPM, resurrect, continuum, gitmux, tmux-cpu, tmux-yank
- **Vi mode** — Copy mode with vi keys

## Install (everything)

```bash
curl -fsSL https://raw.githubusercontent.com/kevin15011/cyberpunk-plugin/main/install.sh | bash
```

This downloads the binary from the latest GitHub Release, installs it to `~/.local/bin/cyberpunk`, and launches the installer TUI.

Pre-built binaries are published for Linux (`x64`, `arm64`) and macOS (`x64`, `arm64`) using the shared `cyberpunk-{os}-{arch}` asset naming convention.

If `~/.local/bin` is not already in your `PATH`, the script prints the export line you need to add.

### macOS notes

- If macOS blocks the first launch because the binary is unsigned, use Finder → right-click `cyberpunk` → **Open** once, then confirm the prompt.
- Install ffmpeg before using sound generation features: `brew install ffmpeg`

**Alternative**: Clone and build from source (for unsupported platforms or local development):
```bash
git clone https://github.com/kevin15011/cyberpunk-plugin.git
cd cyberpunk-plugin
bun install && bun run build
./cyberpunk tui
```

Then restart opencode. The plugin will auto-configure on first load, install both review phases, patch the local SDD flow, and re-bootstrap `context-mode` integration if OpenCode or Gentle AI updates overwrite those files.

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

```bash
cp tmux.conf ~/.tmux.conf
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
~/.tmux/plugins/tpm/bin/install_plugins all
tmux source-file ~/.tmux.conf
```

## Requirements

- [opencode](https://opencode.ai)
- **Linux x64/arm64** — Pre-built binary available via curl install
- **macOS x64/arm64** — Pre-built binary available via curl install
- **Linux** — `ffplay` (`sudo apt install ffmpeg`)
- **macOS** — `ffplay` (`brew install ffmpeg`)
- `npm` — Needed for `context-mode` component
- `curl` — Needed for `rtk` component (if rtk not already installed)
- `git` — For TPM installation
- [bun](https://bun.sh) — Only needed if building from source

## Current macOS limitations

- macOS binaries are currently unsigned.
- Signing and notarization are deferred and not part of this MVP.
- Automated macOS CI validation is also deferred; release validation is currently manual.

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
rm ~/.config/opencode/plugins/cyberpunk.ts
rm -rf ~/.config/opencode/sounds/
rm -f ~/.local/bin/cyberpunk
rm ~/.tmux.conf
# Optional: remove RTK routing instructions
rm -f ~/.config/opencode/instructions/rtk-routing.md
```

## Keybindings (tmux)

| Key | Action |
|-----|--------|
| `Ctrl-a` | Prefix |
| `prefix \|` | Split horizontal |
| `prefix -` | Split vertical |
| `prefix h/j/k/l` | Navigate panes |
| `prefix H/J/K/L` | Resize panes |
| `prefix r` | Reload config |
