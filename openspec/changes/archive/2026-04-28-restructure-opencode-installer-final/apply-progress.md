# Apply Progress: restructure-opencode-installer

## Cumulative Task Completion Status

### Phases 1-14: COMPLETE
- All original implementation, review-fix, OS→Tool→Preset flow, OpenCode-only scope enforcement, and clean verification gate tasks remain complete from previous apply progress.

### Phase 15: Verify Blocker Fix (complete)
- [x] 15.1 Confirm missing-binary `codebase-memory:mcp-path` test isolates `PATH` to an empty test directory and restores the original path in `afterEach`.
- [x] 15.2 Re-run `bun test tests/codebase-memory.test.ts --max-concurrency=1`: 17 pass / 0 fail.
- [x] 15.3 Re-run required targeted bundle: 124 pass / 0 fail across 8 files.

### Phase 16: MacOS OpenCode Readiness Scope Correction (complete for apply)
- [x] 16.1 Added an OpenCode SDD readiness manifest and `detectOpenCodeSddReadiness()` for required shared/phase skill files plus optional reportable assets.
- [x] 16.2 Replaced SDD install/status/doctor readiness checks so missing required assets are reported as unavailable/pending with exact paths instead of falsely complete.
- [x] 16.3 Removed `theme` and `sounds` from normal presets while keeping them in `cyberpunk-full` and explicit manual/custom selection.
- [x] 16.4 Made codebase-memory executable resolution deterministic by preferring executable `HOME/.local/bin/codebase-memory-mcp` and scanning the process `PATH` directly instead of relying on host `which` behavior.
- [x] 16.5 Isolated codebase-memory tests from the developer machine `PATH` and extended SDD/preset/TUI coverage for readiness and aesthetic opt-in behavior.
- [x] 16.6 Updated hybrid task artifacts: Engram task artifact #513 and `openspec/changes/restructure-opencode-installer/tasks.md` mark apply-completed items complete; full verification task remains for `sdd-verify`.

### Phase 17: Stale Verify Fixture Repair (complete)
- [x] 17.1 Updated `tests/preflight.test.ts` expectations so normal presets exclude `theme`/`sounds` and SDD Integration preflight discloses every required OpenCode SDD readiness asset.
- [x] 17.2 Updated `tests/doctor-scenarios.test.ts` fixtures so installed/patching scenarios provision all required OpenCode SDD skill assets before expecting readiness or patch checks.
- [x] 17.3 Updated `tests/cli-preset-execution.test.ts` expectations so `minimal` and deprecated `wsl`/`developer-toolkit` preset execution no longer forwards aesthetic components.
- [x] 17.4 Updated `tests/tui-preset-behavior.test.ts` after full-suite verification exposed the same stale normal-preset aesthetic assumptions in the TUI preset path.

### Phase 18: TUI Navigation Hotfix (complete for scoped apply)
- [x] 18.1 Fixed uninstall component selection Esc/back handling so it emits the router back intent, clears transient selection/message state, and no longer gets stuck.
- [x] 18.2 Added global `H`/`h` Home navigation through the app/router layer with nested-flow cleanup for install, uninstall, doctor/repair, upgrade, task, results, and result-detail screens.
- [x] 18.3 Updated TUI footer/help text to document `H inicio` where the shortcut applies, while preserving Esc as one-step back.
- [x] 18.4 Adjusted doctor repair confirmation Esc behavior so Esc cancels confirmation without leaving the doctor screen.
- [x] 18.5 Added focused tests for uninstall Esc/back and one-key Home navigation from nested completed operation flows.

## Verification Commands
- `bun test ./tests/sdd-integration.test.ts ./tests/codebase-memory.test.ts ./tests/tui-install-flow.test.ts --max-concurrency=1` → PASS, 55 pass / 0 fail.
- `bun test ./tests/install-presets.test.ts --max-concurrency=1` → PASS, 28 pass / 0 fail.
- `bun test ./tests/sdd-integration.test.ts ./tests/codebase-memory.test.ts ./tests/tui-install-flow.test.ts ./tests/install-presets.test.ts --max-concurrency=1` → PASS, 83 pass / 0 fail.
- `bun run typecheck` → PASS.
- `bun test ./tests/preflight.test.ts ./tests/doctor-scenarios.test.ts ./tests/cli-preset-execution.test.ts ./tests/tui-preset-behavior.test.ts --max-concurrency=1` → PASS, 67 pass / 0 fail.
- `bun test --max-concurrency=1` → PASS, 834 pass / 0 fail.
- `bun run typecheck` → PASS (`tsc --noEmit`).
- `bun test ./tests/tui-router.test.ts ./tests/tui-screens.test.ts ./tests/tui-install-flow.test.ts --max-concurrency=1` → PASS, 97 pass / 0 fail.
- `bun test ./tests/tui-*.test.ts --max-concurrency=1` → PASS, 152 pass / 0 fail.
- Build was not run because the active project instruction says never build after changes.

## Remaining Work
- [ ] `sdd-verify` should still produce the formal verify report and 0-warning status/doctor acceptance review.
- [ ] Remaining final-polish tasks outside this scoped hotfix: doctor refresh, canonical MCP duplicate cleanup, OTEL removal, and formal verification.

## Status
Scoped TUI navigation hotfix complete. This progress artifact MERGES the previous completed Phases 1-17 with the new Phase 18 navigation fixes; non-navigation final-polish tasks remain pending.
