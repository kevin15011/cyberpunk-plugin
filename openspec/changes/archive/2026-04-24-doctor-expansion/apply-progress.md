# Implementation Progress

**Change**: doctor-expansion
**Mode**: Strict TDD

### Completed Tasks
- [x] 1.1 Add `detail?: { group?: string; nextStep?: string }` to `DoctorCheck` in `src/components/types.ts`
- [x] 1.2 Export `getPlaybackDependency()` and `getPlatformLabel()` helpers in `src/platform/detect.ts`
- [x] 2.1 Add `platform:opencode` runtime guidance check
- [x] 2.2 Add `platform:playback` runtime guidance check
- [x] 2.3 Add `plugin:source-drift` detection with managed-path fixability
- [x] 2.4 Add `sounds:invalid` RIFF-header validation
- [x] 3.1 Wire runtime checks into `collectPlatformChecks()`
- [x] 3.2 Add `applyPluginDriftFix()` managed reinstall handler
- [x] 3.3 Add `applySoundValidityFix()` invalid-only regeneration handler
- [x] 3.4 Group text doctor output and append next actions summary
- [x] 4.1 Add runtime/playback coverage in `tests/doctor.test.ts`
- [x] 4.2 Add plugin source drift scenarios in `tests/doctor-scenarios.test.ts`
- [x] 4.3 Add sound validity and fix coverage in `tests/doctor-scenarios.test.ts`
- [x] 4.4 Add grouped text output coverage while preserving JSON contract

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `src/components/types.ts` | Modified | Added optional doctor output metadata for grouping and next steps. |
| `src/platform/detect.ts` | Modified | Exported playback dependency and platform label helpers. |
| `src/components/platform.ts` | Modified | Added runtime doctor checks for OpenCode CLI and playback dependencies. |
| `src/components/plugin.ts` | Modified | Added plugin source drift detection and managed restore helper. |
| `src/components/sounds.ts` | Modified | Added RIFF-header validation and targeted regeneration helper. |
| `src/commands/doctor.ts` | Modified | Wired new checks and fix handlers for plugin drift and invalid sounds. |
| `src/cli/output.ts` | Modified | Grouped text output by area and added next-actions summary. |
| `tests/doctor.test.ts` | Modified | Added runtime guidance coverage. |
| `tests/doctor-scenarios.test.ts` | Modified | Added drift/validity/output scenarios and updated healthy fixtures. |
| `tests/preflight.test.ts` | Modified | Preserved real `platform`/`detect` exports inside Bun module mocks and added a leak regression test. |
| `tests/cli-preset-execution.test.ts` | Modified | Preserved real `detect` exports inside Bun module mocks to stop cross-suite doctor import breakage. |
| `tests/tui-preset-behavior.test.ts` | Modified | Preserved real `detect` exports inside Bun module mocks to stop cross-suite doctor import breakage. |
| `openspec/changes/doctor-expansion/tasks.md` | Modified | Kept all implementation tasks complete. |

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/doctor.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Covered in grouped/JSON scenarios plus runtime summary assertions | ➖ None needed |
| 1.2 | `tests/doctor.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Linux/platform guidance scenarios exercise exported helpers through doctor checks | ➖ None needed |
| 2.1 | `tests/doctor.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Missing-runtime scenarios verify warning state plus actionable next step | ➖ None needed |
| 2.2 | `tests/doctor.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Playback guidance scenarios cover alternate dependency path | ➖ None needed |
| 2.3 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Managed-path and non-managed drift scenarios both pass | ➖ None needed |
| 2.4 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Valid WAV, invalid WAV, and fix-only-invalid scenarios pass | ➖ None needed |
| 3.1 | `tests/doctor.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Runtime checks exercised through `runDoctor()` end-to-end summary coverage | ➖ None needed |
| 3.2 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Drift detection and managed repair path both covered | ➖ None needed |
| 3.3 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Invalid-only regeneration path covered with fix scenario | ➖ None needed |
| 3.4 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Grouped text output and JSON stability scenarios both pass | ➖ None needed |
| 4.1 | `tests/doctor.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Runtime binary + playback dependency paths both verified | ➖ None needed |
| 4.2 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Matching source, managed drift, and unmanaged drift all verified | ➖ None needed |
| 4.3 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Valid/invalid/fix flows all verified | ➖ None needed |
| 4.4 | `tests/doctor-scenarios.test.ts` | Unit | ✅ Prior batch baseline captured | ✅ Prior batch test-first evidence carried forward | ✅ `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` (57/57) and `bun test` (288/288) | ✅ Multiple grouped sections plus JSON contract remain covered | ➖ None needed |
| Final blocker fix | `tests/preflight.test.ts`, `tests/cli-preset-execution.test.ts`, `tests/tui-preset-behavior.test.ts` | Unit | ✅ `bun test tests/preflight.test.ts` (6/6), `bun test tests/plugin.patch.test.ts` (22/22), `bun test tests/tui-preset-behavior.test.ts` (8/8 baseline) | ✅ Added `platform partial mock preserves runtime doctor exports`; RED showed missing export from partial `detect`/`platform` mocks | ✅ `bun test tests/preflight.test.ts` (7/7), `bun test tests/preflight.test.ts tests/doctor.test.ts` (25/25), `bun test tests/cli-preset-execution.test.ts` (5/5), `bun test tests/cli-preset-execution.test.ts tests/doctor.test.ts` (23/23), `bun test tests/tui-preset-behavior.test.ts` (8/8), `bun test tests/tui-preset-behavior.test.ts tests/doctor.test.ts` (26/26) | ✅ Fixed all three leaking partial mocks; confirmed `tests/plugin.patch.test.ts` still green (22/22) with no expectation drift remaining | ✅ Kept scope to test-mock hygiene only; no production code changes |

### Test Summary
- **Total tests written**: 1 new regression test in `tests/preflight.test.ts`
- **Total tests passing**: 288 project tests passing in final full-suite run
- **Layers used**: Unit (288), Integration (0), E2E (0)
- **Approval tests** (refactoring): None — no production refactor in this batch
- **Pure functions created**: 0

### Deviations from Design
None — implementation remains aligned with the existing doctor-expansion design and only repaired test isolation around it.

### Issues Found
- Root cause of the full-suite failures was leaked partial Bun module mocks in `tests/preflight.test.ts`, `tests/cli-preset-execution.test.ts`, and `tests/tui-preset-behavior.test.ts`; they replaced `platform` / `detect` exports wholesale, so later doctor imports could not resolve `getRuntimeDependencyChecks()` / `getPlatformLabel()`.
- `tests/plugin.patch.test.ts` no longer reproduces the earlier verify warning; the missing-file expectation currently passes unchanged (`22/22`).

### Remaining Tasks
- [ ] None.

### Verification
- `bun test tests/preflight.test.ts`
- `bun test tests/preflight.test.ts tests/doctor.test.ts`
- `bun test tests/cli-preset-execution.test.ts`
- `bun test tests/cli-preset-execution.test.ts tests/doctor.test.ts`
- `bun test tests/tui-preset-behavior.test.ts`
- `bun test tests/tui-preset-behavior.test.ts tests/doctor.test.ts`
- `bun test tests/plugin.patch.test.ts`
- `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts`
- `bun test`
- `bun run tsc --noEmit`

### Status
14/14 tasks complete. Final verify blockers cleared; ready for verify/archive.
