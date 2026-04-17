# Cyberpunk Plugin for OpenCode

A self-installing cyberpunk theme + sound pack for [opencode](https://opencode.ai). Drop it in your plugins folder and everything configures itself.

## Features

- **Cyberpunk theme** — Dark backgrounds, neon pink/cyan/green accents, syntax highlighting
- **4 custom sounds** — Generated with ffmpeg on first run (no audio files to ship)
  - `idle` — Dark/dystopia tone when a task completes
  - `error` — Low descending tone on session errors
  - `compact` — Neural compression sound on context compaction
  - `permission` — Alert beep when opencode asks for permission
- **ASCII banner** — Cyberpunk welcome banner on session start
- **Cross-platform** — macOS (`afplay`) and Linux (`ffplay`)

## Install

```bash
mkdir -p ~/.config/opencode/plugins
curl -o ~/.config/opencode/plugins/cyberpunk.ts https://raw.githubusercontent.com/kevin15011/cyberpunk-plugin/main/cyberpunk.ts
```

Then restart opencode. On first load the plugin will:

1. Install the cyberpunk theme to `~/.config/opencode/themes/cyberpunk.json`
2. Set the theme as active in `~/.config/opencode/tui.json`
3. Generate all sound files in `~/.config/opencode/sounds/`

## Requirements

- [opencode](https://opencode.ai)
- **macOS** — `afplay` (built-in), no extra deps
- **Linux** — `ffplay` (install with `sudo apt install ffmpeg`)
- `ffmpeg` — Needed on first run to generate sound files

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
```

The theme file at `~/.config/opencode/themes/cyberpunk.json` can stay or be removed manually.
