# Proposal: Tmux Component

## Intent

Productize the bundled `tmux.conf` as a first-class cyberpunk component so users can install, inspect, and remove it from the CLI/TUI without destructive manual file replacement.

## Scope

### In Scope
- Add `tmux` as a selectable/installable component in CLI flags, command registries, and TUI lists.
- Manage `~/.tmux.conf` with idempotent `# cyberpunk-managed:start/end` markers.
- Add tmux status/doctor coverage for binary, managed config, TPM presence, and `gitmux` availability.
- Track tmux install state in `~/.config/cyberpunk/config.json` and update README guidance.

### Out of Scope
- TPM clone/install/update workflows.
- Auto-reloading active tmux sessions.
- Per-plugin health or config customization.
- WSL/macOS edge-case tuning beyond shared path handling.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cyberpunk-install`: add `--tmux` install/uninstall behavior with non-destructive config ownership.
- `cyberpunk-tui`: surface tmux as an additional component in interactive and flag-driven flows.
- `doctor`: add tmux-specific checks and safe fix behavior for missing managed config.
- `cyberpunk-config`: persist `components.tmux` state alongside existing components.

## Approach

Implement `src/components/tmux.ts` using the existing `ComponentModule` pattern. Install appends the bundled asset into `~/.tmux.conf` inside one managed block, uninstall removes only that block, status reports `installed|available|error` based on tmux binary plus markers, and doctor reports non-fatal warnings for TPM/`gitmux` gaps while only auto-fixing missing managed config.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/tmux.ts` | New | Tmux module install/uninstall/status/doctor |
| `src/config/schema.ts` | Modified | Add `tmux` component identity + config shape |
| `src/commands/{install,status,doctor}.ts` | Modified | Register tmux workflows |
| `src/cli/parse-args.ts` | Modified | Add `--tmux` handling |
| `README.md` | Modified | Replace manual-only tmux instructions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| User config corruption | Med | Backup before write; only edit managed markers |
| Missing tmux/`gitmux`/TPM | High | Status + doctor surface actionable warnings |
| Marker drift/idempotency bugs | Med | Single managed block with deterministic replace/remove |

## Rollback Plan

Remove tmux registries/module, delete the managed block from `~/.tmux.conf`, clear `components.tmux` state, and restore README text. If install writes fail, leave the original file from backup untouched.

## Dependencies

- Bundled `tmux.conf` asset
- User-local `tmux` binary on PATH for successful installed status

## Success Criteria

- [ ] `cyberpunk install|uninstall|status --tmux` works without overwriting unmanaged tmux config.
- [ ] TUI and config models treat tmux as a first-class component.
- [ ] `cyberpunk doctor` reports tmux health and only fixes safe config ownership issues.
