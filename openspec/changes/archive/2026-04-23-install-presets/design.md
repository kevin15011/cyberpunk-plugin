# Design: Install Presets

## Technical Approach

Slice 1 adds a thin preset layer in front of the existing install pipeline. `minimal` and `full` resolve to existing `ComponentId[]` values, then flow through `runInstall()` unchanged so component installers remain the source of truth for dependency checks, idempotency, config writes, and partial-failure handling.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Preset source | Config file; code registry | Code registry in `src/presets/definitions.ts` | Presets are product defaults, not user state; avoids schema/config changes in slice 1. |
| Resolver output | `ComponentId[]` only; richer install plan | `ResolvedPreset { id, components, warnings }` | Keeps orchestration simple while letting CLI/TUI share the same summary and warning text. |
| CLI confirmation | Always prompt; never prompt; TUI-only prompt | TUI confirms, CLI prints warnings and proceeds | Preserves current non-interactive CLI behavior without introducing a new `--yes` flag in slice 1. |
| `full` behavior | New logic path; alias to existing orchestration | Resolve to all current components, then call `runInstall()` | Reuses tested install sequencing and keeps `--all` backward-compatible. |

## Data Flow

```text
CLI args / TUI choice
  -> preset resolver
    -> preset summary + warnings + ComponentId[]
      -> existing runInstall(componentIds)
        -> component modules
          -> filesystem + config writes
```

Sequence for preset installs:

`parseArgs`/`runTUI` -> `resolvePreset()` -> show preset contents + warnings -> `runInstall(resolved.components)` -> `formatInstallResults()`.

Warnings are informational only in slice 1. The resolver does not probe the system; it derives messages from preset metadata, e.g. `full` warns that `sounds` needs ffmpeg, `context-mode` needs npm, `rtk` needs curl, and `tmux` edits only the managed block in `~/.tmux.conf`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/presets/definitions.ts` | Create | Closed slice-1 registry for `minimal` and `full`, labels, descriptions, component lists, and warning metadata. |
| `src/presets/resolve.ts` | Create | Validates preset names and returns `ResolvedPreset`. |
| `src/cli/parse-args.ts` | Modify | Parse `--preset <name>` and reject mixing it with `--all` or explicit component flags. |
| `src/commands/install.ts` | Modify | Add a preset-aware entry that resolves presets into component IDs before calling existing `runInstall()`. |
| `src/index.ts` | Modify | Pass parsed preset selections into the install command path and print parser validation errors cleanly. |
| `src/tui/index.ts` | Modify | Add “install from preset” as the first install branch, then confirm before execution. |
| `src/cli/output.ts` | Modify | Add help text/examples and a small preset summary formatter reused by CLI/TUI. |
| `tests/parse-args.test.ts` | Modify | Cover `--preset`, missing value, and exclusivity rules. |
| `tests/install-presets.test.ts` | Create | Cover resolver output, warning text, and preset-to-orchestration mapping. |

## Interfaces / Contracts

```ts
export type PresetId = "minimal" | "full"

export interface PresetDefinition {
  id: PresetId
  label: string
  description: string
  components: ComponentId[]
  warnings: string[]
}

export interface ResolvedPreset {
  id: PresetId
  label: string
  components: ComponentId[]
  warnings: string[]
}
```

Parser contract: `--preset` is install-only and mutually exclusive with `--all`, `--plugin`, `--theme`, `--sounds`, `--context-mode`, `--rtk`, and `--tmux`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Preset registry/resolver | Assert `minimal` -> `plugin,theme`; `full` -> all six components; invalid preset throws/returns validation error. |
| Unit | CLI parsing | Extend Bun tests for `--preset minimal`, missing value, and mutual exclusion with component flags / `--all`. |
| Integration | Install orchestration reuse | Spy/stub preset-aware entry so resolved component lists are passed into the existing `runInstall()` unchanged. |
| Manual | TUI flow | Confirm preset-first path, warning/confirmation screen, cancel path, and legacy manual multiselect still work. |

## Migration / Rollout

No migration required. Presets are install-time shortcuts only; no config schema, doctor output, or status model changes are needed.

## Open Questions

- [ ] Should CLI preset installs print the preset summary before or after the spinner/result block? Design assumes before execution so warnings are visible up front.
- [ ] Should `full` stay an independent preset if future slices diverge from `--all`? Design assumes yes, while both map to the same components in slice 1.
