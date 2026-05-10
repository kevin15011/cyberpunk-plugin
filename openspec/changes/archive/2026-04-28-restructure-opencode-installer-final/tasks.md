# Tasks: Restructure OpenCode Installer — Final macOS OpenCode Polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350-520 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 TUI/MCP repair → PR2 OTEL removal/docs/tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | TUI refresh/Home + MCP cleanup | PR 1 | UX/config tests |
| 2 | Remove OTEL surface + docs | PR 2 | Deletions/tests |

## Phase 1: SDD Readiness Foundation

- [x] 1.1 Add OpenCode SDD readiness manifest in `src/components/sdd-integration.ts` for `_shared/sdd-phase-common.md` and core `sdd-*/SKILL.md`.
- [x] 1.2 Add `detectOpenCodeSddReadiness()` returning ready state plus missing required/optional asset paths.
- [x] 1.3 Replace `detectSddPhaseCommon()` install gating with readiness gating; skipped result must list missing required assets.

## Phase 2: Status, Doctor, Presets

- [x] 2.1 Update `checkSddIntegrationDoctor()` to fail/warn when readiness is incomplete; never pass on only `sdd-phase-common.md`.
- [x] 2.2 Surface SDD readiness/missing files in `src/commands/status.ts` and `src/commands/preflight.ts`.
- [x] 2.3 Remove `theme`/`sounds` from normal presets in `src/presets/definitions.ts`; keep only in `cyberpunk-full`.
- [x] 2.4 Ensure Custom/manual selection can still explicitly choose `theme` and `sounds`.

## Phase 3: Deterministic codebase-memory

- [x] 3.1 Refactor `src/components/codebase-memory.ts` executable resolution for isolated PATH and deterministic `HOME/.local/bin` tests.
- [x] 3.2 Update `tests/codebase-memory.test.ts` to isolate PATH and avoid the user's real PATH.

## Phase 4: Tests and Mac OpenCode Validation

- [x] 4.1 Extend `tests/sdd-integration.test.ts` for ready, missing, partial, skipped install, and doctor messages.
- [x] 4.2 Update preset/TUI tests: normal presets exclude `theme`/`sounds`; Full/Custom allow them.
- [x] 4.3 Run focused checks: `bun test tests/sdd-integration.test.ts tests/codebase-memory.test.ts tests/tui-install-flow.test.ts --max-concurrency=1`.
- [ ] 4.4 Run full verification: `bun test --max-concurrency=1` and `bun run typecheck`; require 0 warnings in verify report.

## Phase 5: Final TUI and MCP Polish

- [ ] 5.1 In `src/tui/screens/doctor.ts`, re-run/refresh diagnostics after repair before rendering completion.
- [x] 5.2 Add one-key Home/root shortcut in completed `src/tui/screens/{install,uninstall,doctor,results,result-detail}.ts`; route through app/router.
- [x] 5.3 In `src/components/codebase-memory.ts`, remove legacy `codebase-memory-mcp` MCP key and keep canonical `codebase-memory` with absolute command.
- [ ] 5.4 Add tests for doctor refresh, Home shortcut, and duplicate MCP cleanup using `/Users/kevinlondono/.local/bin/codebase-memory-mcp`.

## Phase 6: Remove OTEL and Verify Cleanly

- [x] 6.1 Remove `otel`/`otel-collector` from registry, presets, CLI flags/help, preflight/status/doctor, and TUI selections.
- [x] 6.2 Delete/quarantine OTEL component tests; update tests to assert OTEL is not installable.
- [x] 6.3 Update `README.md`/docs with safe legacy cleanup for OTEL plugin/env/config/service state only.
- [ ] 6.4 Run `bun test --max-concurrency=1`, `bun run typecheck`, and strict SDD verify; accept only 0 warnings.
