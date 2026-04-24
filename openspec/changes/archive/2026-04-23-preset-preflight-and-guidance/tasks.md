# Tasks: Preset Preflight and Guidance

## Phase 1: Foundation — Types and Preflight Builder

- [x] 1.1 Create `src/commands/preflight.ts` with `PreflightDependencyStatus`, `ComponentPreflightStatus`, and `PresetPreflightSummary` interfaces per design contracts
- [x] 1.2 Add `FILE_TOUCH_MAP: Record<ComponentId, string[]>` static advisory map in `src/commands/preflight.ts` (plugin→plugins/cyberpunk.ts, theme→themes/cyberpunk.json + tui.json, sounds→sounds/*.wav, context-mode→opencode.json + routing docs, rtk→routing docs + opencode.json, tmux→~/.tmux.conf managed block)
- [x] 1.3 Add `DEPENDENCY_MAP: Record<ComponentId, { id: PreflightDependencyStatus["id"]; label: string; severity: "info" | "warn" }[]>` in `src/commands/preflight.ts` (sounds→ffmpeg, context-mode→npm/bun, rtk→curl)
- [x] 1.4 Implement `buildPresetPreflight(resolved: ResolvedPreset): Promise<PresetPreflightSummary>` — calls `checkPlatformPrerequisites()`, `collectStatus(resolved.components)`, merges warnings, maps dependency readiness onto components, attaches file-touch advisories

## Phase 2: CLI/TUI Formatting and Wiring

- [x] 2.1 Add `formatPresetPreflight(summary: PresetPreflightSummary): string` in `src/cli/output.ts` — sectioned output: components with installed/ready badges, dependency readiness table, file-touch advisories, warnings; replace existing `formatPresetSummary`
- [x] 2.2 Update `src/index.ts` CLI preset branch: call `buildPresetPreflight(resolved)` before `runInstall()`, print via `formatPresetPreflight()` instead of `formatPresetSummary()`
- [x] 2.3 Update `src/tui/index.ts` `handleInstall()`: call `buildPresetPreflight(resolved)`, show formatted preflight in `clack.note()` before the confirm prompt
- [x] 2.4 Remove the now-unused `formatPresetSummary()` export from `src/cli/output.ts` and its imports in `src/index.ts` and `src/tui/index.ts`

## Phase 3: Testing

- [x] 3.1 Create `tests/preflight.test.ts` — unit tests for `buildPresetPreflight` with stubbed prerequisites and statuses for each preset (minimal/full/wsl/mac); assert dependency grouping, installed flags, warnings, and file-touch advisories
- [x] 3.2 Add formatter snapshot tests in `tests/preflight.test.ts` for `formatPresetPreflight` — verify sectioned output structure and degraded-readiness messaging
- [x] 3.3 Verify CLI integration: `bun test tests/cli-preset-execution.test.ts` still passes with the richer preflight output; update assertions if format changes
- [x] 3.4 Verify TUI integration: `bun test tests/tui-preset-behavior.test.ts` still passes; update if preflight replaces the old summary note

## Phase 4: Cleanup

- [x] 4.1 Run `bun run tsc --noEmit` and fix any type errors from new interfaces
- [x] 4.2 Run `bun test` to confirm full test suite passes
