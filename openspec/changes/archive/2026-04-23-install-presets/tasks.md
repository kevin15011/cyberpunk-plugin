# Tasks: Install Presets

## Phase 1: Foundation — Types & Registry

- [x] 1.1 Create `src/presets/definitions.ts` — export `PresetId`, `PresetDefinition`, `ResolvedPreset` types; export `PRESET_DEFINITIONS` map with `minimal` (`plugin`, `theme`) and `full` (all six `COMPONENT_IDS`) entries including labels, descriptions, component lists, and warning arrays
- [x] 1.2 Create `src/presets/resolve.ts` — export `resolvePreset(name: string): ResolvedPreset` that looks up `PRESET_DEFINITIONS`, throws on unknown/deferred names (`wsl`, `mac`); export `PRESET_NAMES` constant for CLI/TUI option rendering
- [x] 1.3 Create `src/presets/index.ts` — barrel re-export of `resolvePreset`, `PRESET_NAMES`, and types

## Phase 2: CLI Integration

- [x] 2.1 Modify `src/cli/parse-args.ts` — add `preset?: string` to `ParsedArgs`; parse `--preset <name>` (next argv value); add validation: if `preset` is set alongside `--all` or any component flag, store error in `ParseError`
- [x] 2.2 Modify `src/cli/output.ts` — add `formatPresetSummary(resolved: ResolvedPreset): string` showing label, component list, and warnings; add `--preset` section to `formatHelp()` examples
- [x] 2.3 Modify `src/index.ts` — in `install` case: if `args.preset`, call `resolvePreset(args.preset)`, print `formatPresetSummary()`, then pass `resolved.components` to `runInstall()`

## Phase 3: TUI Integration

- [x] 3.1 Modify `src/tui/index.ts` `handleInstall()` — before the existing multiselect, add a `clack.select` offering preset choices (`minimal`, `full`, "Selección manual"); if a preset is chosen, show `formatPresetSummary()` then a confirmation `clack.confirm` before calling `runInstall(resolved.components)`
- [x] 3.2 Ensure deferred presets (`wsl`, `mac`) are never rendered in TUI options by building the select list from `PRESET_NAMES`

## Phase 4: Testing

- [x] 4.1 Create `tests/install-presets.test.ts` — unit tests: `resolvePreset("minimal")` → `[plugin, theme]`; `resolvePreset("full")` → all six; unknown/deferred name throws; warnings are populated for `full`
- [x] 4.2 Modify `tests/parse-args.test.ts` — cover `--preset minimal`, `--preset full`, missing value, mutual exclusion with `--all` and `--theme`; assert `preset` field and parse error when combined
