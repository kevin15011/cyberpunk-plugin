# Tasks: WSL and Mac Presets

## Phase 1: Foundation

- [x] 1.1 Create `src/platform/detect.ts` exporting `DetectedEnvironment` type (`"linux" | "wsl" | "darwin"`), `detectEnvironment(): DetectedEnvironment` (checks `process.platform`, then `/proc/version` for WSL), and `isWSL(): boolean`
- [x] 1.2 In `src/presets/definitions.ts`, expand `PresetId` union to `"minimal" | "full" | "wsl" | "mac"` and add `wsl` preset (components: `plugin, theme, sounds, tmux`; platform warning for WSL) and `mac` preset (components: `plugin, theme, sounds, context-mode, rtk`; platform warning for macOS)

## Phase 2: Core Logic

- [x] 2.1 In `src/presets/resolve.ts`, remove `DEFERRED_PRESETS` set and the deferred-rejection block from `resolvePreset()`
- [x] 2.2 In `src/presets/resolve.ts`, import `detectEnvironment` and append a mismatch warning to the returned warnings array when the preset's target platform doesn't match `detectEnvironment()` (wsl → `"wsl"`, mac → `"darwin"`); preserve copy-on-return semantics

## Phase 3: CLI / Help Updates

- [x] 3.1 In `src/cli/output.ts` `formatHelp()`, update `--preset` line to show `(minimal, full, wsl, mac)` and add example lines for `--preset wsl` and `--preset mac`

## Phase 4: Tests

- [x] 4.1 In `tests/install-presets.test.ts`, replace deferred-throw assertions for `wsl`/`mac` with successful-resolution checks, verify component lists and mismatch warnings, update `PRESET_NAMES` and `PRESET_DEFINITIONS` count assertions
- [x] 4.2 In `tests/cli-preset-execution.test.ts`, replace `wsl` deferred-error test with a successful `wsl` preset execution test asserting summary prints and `runInstall` receives the wsl component list
- [x] 4.3 In `tests/tui-preset-behavior.test.ts`, update `PRESET_NAMES` assertion to include `wsl` and `mac`, add test for `wsl` preset selection through TUI with platform mismatch warning surfaced in confirmation note
- [ ] 4.4 Run full test suite (`bun test`) and verify all tests pass
