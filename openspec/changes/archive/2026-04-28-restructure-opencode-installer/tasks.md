# Tasks: Restructure OpenCode Installer

## Phase 1: Foundation — Types, Registry, Config Schema

- [x] 1.1 Add `"opencode-event-sounds"` and `"sdd-integration"` to `ComponentId` union type in `src/components/types.ts`; add alias map `COMPONENT_ID_ALIASES`.
- [x] 1.2 Add `sdd-integration` to supported component ids in `src/components/registry.ts` for OpenCode linux/wsl/darwin.
- [x] 1.3 Add `sdd-integration` defaults in `src/config/schema.ts`; rename plugin label.
- [x] 1.4 Add `normalizeComponentId(id)` helper in `src/components/types.ts`.

## Phase 2: New Component — sdd-integration

- [x] 2.1 Create `src/components/sdd-integration.ts` with factory returning `install`, `uninstall`, `doctor`.
- [x] 2.2 Implement `detectSddPhaseCommon()` — check sdd-phase-common.md existence.
- [x] 2.3 Implement `patchSddPhaseCommon()` — inject/replace marker block idempotently.
- [x] 2.4 Implement `unpatchSddPhaseCommon()` — remove only managed marker block.
- [x] 2.5 Implement `checkSddIntegrationDoctor()` — verify file/markers/content; report drift.

## Phase 3: Plugin Component Cleanup

- [x] 3.1 Remove SDD patch constants, `patchSddPhaseCommon()` call, `plugin:patching` from `src/components/plugin.ts`.
- [x] 3.2 Update `PLUGIN_SOURCE` template — remove Section E/F injection; keep sound hooks only.
- [x] 3.3 Rename internal label to `"OpenCode Event Sounds"`.

## Phase 4: Presets & Compatibility Aliases

- [x] 4.1 Define new presets in `src/presets/definitions.ts`: `minimal`, `token-saver-general`, `token-saver-dev`, `developer-toolkit`, `cyberpunk-full`, `custom`.
- [x] 4.2 Add `PRESET_ALIASES` map with deprecation warnings.
- [x] 4.3 Update `src/presets/resolve.ts` — normalize aliases, emit warnings.

## Phase 5: Installer, Doctor, Preflight, Status Wiring

- [x] 5.1 Register `sdd-integration` factory in `src/commands/install.ts`; route CLI flag.
- [x] 5.2 Add `sdd-integration` to doctor iteration; move fix handler; update repair order.
- [x] 5.3 Add `sdd-integration` file-touch checks in `src/commands/preflight.ts`.
- [x] 5.4 Add `sdd-integration` display row in `src/commands/status.ts`.

## Phase 6: Codebase-Memory MCP Path Fix

- [x] 6.1 Add `resolveCodebaseMemoryExecutable()` — resolve bare name to absolute path.
- [x] 6.2 Update install/doctor to write `command:[absolutePath]`.
- [x] 6.3 Add doctor check: bare name → fail fixable; missing binary → fail not fixable.

## Phase 7: Tests (Original)

- [x] 7.1 Create `tests/sdd-integration.test.ts` — patch idempotence, drift, missing file, uninstall.
- [x] 7.2 Update `tests/plugin.patch.test.ts` — assert zero SDD strings in PLUGIN_SOURCE.
- [x] 7.3 Update preset tests — new presets and alias resolution with warnings.
- [x] 7.4 Extend `tests/codebase-memory.test.ts` — absolute path, bare-name fix, missing-binary.
- [x] 7.5 Update doctor tests — sdd-integration:patching, repair order, plugin no-patching.
- [x] 7.6 Run full suite and typecheck.

## Phase 8: Docs & Migration Validation

- [x] 8.1 Update `README.md` — component table, preset migration guide.
- [x] 8.2 Validate old config backward compatibility.

## Phase 9: Review Fixes

- [x] 9.1 Fix `codebase-memory:mcp-path` doctor repair handler.
- [x] 9.2 Add regression tests for MCP path repair.
- [x] 9.3 Align spec wording — `plugin` canonical, `opencode-event-sounds` alias.

## Phase 10: Verify Fixes

- [x] 10.1 Fix `checkSddIntegrationDoctor` — empty checks when not installed.
- [x] 10.2 Add `rtk` to presets/specs alignment.
- [x] 10.3 Add regression tests for not-installed sdd-integration doctor.
- [x] 10.4 Classify baseline failures as pre-existing.

## Phase 11: OS→Tool→Preset TUI Flow

- [x] 11.1 Extend `InstallPhase` in `src/tui/types.ts` to `"os-select" | "tool-select" | "preset" | "manual" | "confirm"`; add `selectedOS?: DetectedEnvironment` and `selectedTool?: AgentTarget` fields to `TUIState`.
- [x] 11.2 Add `os-select` phase to `src/tui/screens/install.ts` — auto-detect via `detectEnvironment()`, show macOS/Linux options, default to detected, allow change with ↑/↓/Enter.
- [x] 11.3 Add `tool-select` phase — show OpenCode (active/selectable), Claude/Codex (disabled, labeled "Coming soon / Not yet implemented"). Selecting disabled tool shows info message and stays on phase.
- [x] 11.4 Gate preset/manual/confirm phases: only render after `selectedOS` and `selectedTool === "opencode"` are set. Back navigation from preset returns to tool-select.
- [x] 11.5 Add `implemented: boolean` field to `AgentDetectResult` in `src/detection/types.ts`. Set `true` for OpenCode, `false` for Claude/Codex.
- [x] 11.6 Update `src/detection/agents/claude.ts` — return `{ implemented: false }` in detect result.
- [x] 11.7 Update `src/detection/agents/codex.ts` — return `{ implemented: false }` in detect result.

## Phase 12: OpenCode-Only Scope Enforcement

- [x] 12.1 Add `targets` filter to `src/components/registry.ts` — `plugin`, `sdd-integration`, `context-mode`, `rtk`, `codebase-memory` return empty/unsupported for non-OpenCode targets.
- [x] 12.2 Validate component-target mapping: OpenCode components never appear when Claude/Codex is the selected tool in TUI or CLI.

## Phase 13: Clean Verification Baseline

- [x] 13.1 Fix or skip `tests/upgrade-mode.test.ts` — 4 failures: convert to explicit skip/pass with platform rationale (macOS quarantine, darwin-arm64 asset mismatch).
- [x] 13.2 Fix or skip `tests/cli-doctor-upgrade-entry.test.ts` — 1 failure: subprocess timeout/root-cause and fix or skip with rationale.
- [x] 13.3 Fix or skip `tests/doctor-scenarios.test.ts` sounds cases — 2 failures: fix `sounds:invalid` fixability or convert to explicit skip.
- [x] 13.4 Ensure `tsc` is available: add `typescript` to devDependencies if missing; verify `bun run typecheck` passes with exit code 0.
- [x] 13.5 Run `bun test --max-concurrency=1` — confirm 0 fail (all pass or explicit skip).
- [x] 13.6 Run `bun run typecheck` — confirm exit code 0, reproducible.

## Phase 14: Full Clean Verification Gate

- [x] 14.1 Run `bun test --max-concurrency=1 && bun run typecheck` — both must pass clean.
- [x] 14.2 Verify TUI OS→tool→preset flow with integration tests.
- [x] 14.3 Verify Claude/Codex selection shows "not implemented" and does NOT expose OpenCode components.
- [x] 14.4 Full verify result: 0 CRITICAL, 0 WARNING.

## Phase 15: Latest Verify Blocker Fix

- [x] 15.1 Confirm missing-binary `codebase-memory:mcp-path` test isolates `PATH` to an empty test directory and restores the original path in `afterEach`.
- [x] 15.2 Re-run the focused `tests/codebase-memory.test.ts` suite with serial execution.
- [x] 15.3 Re-run the required targeted verification bundle with serial execution.
