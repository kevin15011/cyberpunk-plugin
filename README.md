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
- **Cross-platform** — macOS (`afplay`) and Linux (`ffplay`)

### Tmux Config
- **Cyberpunk HUD** — Neon status bar with CPU, RAM, git branch, clock
- **Vim keybindings** — `Ctrl-a` prefix, `h/j/k/l` pane navigation, `|/-` splits
- **Plugins** — TPM, resurrect, continuum, gitmux, tmux-cpu, tmux-yank
- **Vi mode** — Copy mode with vi keys

## Install (everything)

```bash
git clone git@github.com:kevin15011/cyberpunk-plugin.git
cd cyberpunk-plugin
chmod +x install.sh
./install.sh
```

Then restart opencode. The plugin will auto-configure on first load.

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
- [tmux](https://github.com/tmux/tmux) >= 3.2
- **macOS** — `afplay` (built-in)
- **Linux** — `ffplay` (`sudo apt install ffmpeg`)
- `ffmpeg` — Needed on first run to generate sound files
- `git` — For TPM installation

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
rm ~/.tmux.conf
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
