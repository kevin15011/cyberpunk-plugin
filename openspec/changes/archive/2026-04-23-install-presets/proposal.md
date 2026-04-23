# Proposal: Install Presets

## Intent

Reduce install friction by letting users choose named presets instead of remembering component combinations, while preserving existing per-component install behavior and avoiding unsafe environment-specific automation in slice 1.

## Scope

### In Scope
- Add preset resolution for `minimal` and `full` over existing component IDs.
- Add `cyberpunk install --preset <name>` and a TUI preset-first install path.
- Show preset contents and dependency/tmux warnings before execution.

### Out of Scope
- `wsl` and `mac` preset execution in slice 1; define them as deferred expansions only.
- Custom/user-defined presets, preset persistence, preset upgrades, or doctor/status changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cyberpunk-install`: add preset-based install selection, mutual exclusion with individual component flags, and preflight warnings for optional dependencies / tmux-managed changes.
- `cyberpunk-tui`: add a preset-first guided install flow before manual component multiselect.

## Approach

Implement presets as a thin registry/resolver layer (`preset -> ComponentId[]`) consumed by existing install orchestration. Slice 1 ships only `minimal` (`plugin`, `theme`) and `full` (all components), with confirmation text that explicitly calls out optional dependencies and that `tmux` updates only the managed block in `~/.tmux.conf`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/presets/definitions.ts` | New | Slice-1 preset registry |
| `src/presets/resolve.ts` | New | Preset lookup and validation |
| `src/cli/parse-args.ts` | Modified | `--preset` parsing and exclusivity |
| `src/commands/install.ts` | Modified | Resolve presets into component installs |
| `src/tui/index.ts` | Modified | Preset-first install entry point + confirmation |
| `src/cli/output.ts` | Modified | Help text and preset-aware messaging |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `full` fails on missing deps | Med | Reuse per-component errors; warn before install |
| Users fear tmux overwrite | Med | Explicitly state managed-block behavior before continue |
| Preset scope grows too fast | Low | Defer `wsl`/`mac` to later slice |

## Rollback Plan

Remove preset parser/resolver wiring and TUI preset entry, restoring direct component selection and existing `--all` / per-component flows unchanged.

## Dependencies

- Existing component installers remain source of truth for ffmpeg, npm, curl, and tmux handling.

## Success Criteria

- [ ] Users can run `cyberpunk install --preset minimal|full` without changing component install internals.
- [ ] TUI offers a preset-guided install path plus manual component selection.
- [ ] Slice 1 explicitly defers environment-specific presets (`wsl`, `mac`) from implementation.
