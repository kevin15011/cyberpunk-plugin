## Verification Report

**Change**: toolkit-doctor-repair  
**Version**: N/A  
**Mode**: Standard (`strict_tdd: false`)

---

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

Notes:
- All checklist items in `openspec/changes/toolkit-doctor-repair/tasks.md` are marked complete.
- The current implementation covers the original slice plus the later verify-driven fixes recorded in `apply-progress`.

---

### Build & Tests Execution

**Build**: ✅ Passed (`bun run build`)
```text
exit=0
$ bun run build
[10ms]  bundle  1 modules
[271ms] compile  ./cyberpunk
✓ Binary built: ./cyberpunk
```

**Typecheck**: ✅ Passed (`bun run tsc --noEmit`)
```text
exit=0
```

**Doctor-focused repo tests**: ✅ 41 passed / 0 failed / 0 skipped (`bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts`)
```text
Ran 41 tests across 2 files.
```

**Full test suite**: ❌ 164 passed / 2 failed / 0 skipped (`bun test`)
```text
(fail) runUpgrade dispatch by installMode > repo config dispatches to repo upgrade path [2578.72ms]
(fail) runUpgrade dispatch by installMode > missing mode defaults to repo path [2427.59ms]

Ran 166 tests across 12 files.
```

**Coverage**: 45.91% lines / 52.41% funcs → ➖ No threshold configured (`bun test --coverage`)
```text
All files                        |   52.41 |   45.91 |
```

---

### Runtime Spot Checks

1. **Blank-state read-only CLI smoke**
   - `./cyberpunk doctor` exits `1` on failures.
   - Default output contains the expected table headers: `CHECK`, `STATUS`, `MESSAGE`.
   - `config.json` is **not** auto-created during read-only doctor execution.

2. **Healthy fixture CLI smoke**
   - `./cyberpunk doctor --json` exits `0` on a healthy fixture.
   - Stdout parses as a valid JSON array with 7 grouped result entries (`platform`, `config`, and 5 components).

3. **Exact behavioral harnesses**
   - Additional verification harnesses were run for scenarios whose preconditions are environment-sensitive or not fully representable by the committed repo tests alone (`ffmpeg missing`, exact partial-failure repair, and `module without doctor()` branch).

---

### Spec Compliance Matrix

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| Doctor Command Invocation | All checks pass | `tests/doctor-scenarios.test.ts > S1: all checks pass — every component checks pass, 0 remaining failures` | ✅ COMPLIANT |
| Doctor Command Invocation | At least one check fails | `tests/doctor-scenarios.test.ts > S2: at least one check fails — specific failing checks identified` | ✅ COMPLIANT |
| Platform Prerequisite Checks | ffmpeg missing | `verification harness > exact ffmpeg-missing temporary doctor copy` | ✅ COMPLIANT |
| Plugin Component Checks | Patching drift detected | `verification harness > S4 drift fixture` | ✅ COMPLIANT |
| Theme Component Checks | Theme file exists but tui.json deactivado | `tests/doctor-scenarios.test.ts > S5: theme:activation fails when tui.json has wrong theme` | ✅ COMPLIANT |
| Sounds Component Checks | Partial sound files | `tests/doctor-scenarios.test.ts > S6: sounds:files fails with partial files, lists exactly which files are missing` | ✅ COMPLIANT |
| Context-Mode Component Checks | MCP missing from opencode.json | `verification harness > fake context-mode binary + routing fixture` | ✅ COMPLIANT |
| RTK Component Checks | rtk installed but not registered | `verification harness > fake rtk binary + routing fixture` | ✅ COMPLIANT |
| Config Integrity Check | Corrupted config | `tests/doctor-scenarios.test.ts > S9: config:integrity fails with invalid JSON, fixable false (report-only)` | ✅ COMPLIANT |
| Auto-Repair with --fix | Fix plugin patching drift | `verification harness > S10 patch drift repaired by --fix` | ✅ COMPLIANT |
| Auto-Repair with --fix | Fix with partial failure | `verification harness > plugin patch fixed while context-mode:mcp fix fails` | ✅ COMPLIANT |
| Structured Output | JSON output | `tests/doctor-scenarios.test.ts > S12: formatDoctorJson returns DoctorResult[] array with all components` + healthy CLI smoke | ✅ COMPLIANT |
| ComponentModule Doctor Method | Module with doctor implementation | `tests/doctor-scenarios.test.ts > S13: module with doctor — plugin returns checks` | ✅ COMPLIANT |
| ComponentModule Doctor Method | Module without doctor implementation | `verification harness > patched temporary doctor module emits empty DoctorResult` | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant

---

### Correctness (Static — Structural Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Doctor Command Invocation | ✅ Implemented | `src/cli/parse-args.ts`, `src/index.ts`, and `src/commands/doctor.ts` wire the top-level `doctor` command, `--fix`, `--json`, `--verbose`, read-only behavior, and exit-code derivation. |
| Platform Prerequisite Checks | ✅ Implemented | `src/components/platform.ts` and `collectPlatformChecks()` check `ffmpeg`, `npm`, `bun`, and `curl`, reporting missing prerequisites as warnings with `fixable: false`. |
| Plugin Component Checks | ✅ Implemented | `src/components/plugin.ts` checks plugin file existence, OpenCode registration, and Section E/F patch drift; repair uses temp-file + rename for the patch write. |
| Theme Component Checks | ✅ Implemented | `src/components/theme.ts` delegates to `src/components/theme-doctor.ts` for theme file and `tui.json` activation checks and repair. |
| Sounds Component Checks | ✅ Implemented | `src/components/sounds.ts` checks ffmpeg presence plus all 4 `.wav` files; `src/commands/doctor.ts` includes the regeneration repair stage. |
| Context-Mode Component Checks | ✅ Implemented | `src/components/context-mode.ts` checks npm/bun, binary presence, routing file, and MCP registration; repair is guarded on binary presence. |
| RTK Component Checks | ✅ Implemented | `src/components/rtk.ts` checks binary presence, routing file, and plugin registration; repair is guarded on binary presence. |
| Config Integrity Check | ✅ Implemented | `src/config/load.ts` adds `readConfigRaw()` and `src/components/config-doctor.ts` handles missing, malformed, and incomplete config states without mutating read-only doctor runs. |
| Auto-Repair with --fix | ✅ Implemented | `src/commands/doctor.ts` applies deterministic repair order (`config → plugin patch/register → theme → sounds → context-mode → rtk`) and continues after failures. |
| Structured Output | ✅ Implemented | `src/cli/output.ts` now emits a default table (`CHECK / STATUS / MESSAGE`), verbose table columns (`FIXABLE / FIXED`), and JSON via grouped `results`. |
| ComponentModule Doctor Method | ✅ Implemented | `src/components/types.ts` defines optional `doctor(): Promise<DoctorResult>` and `src/commands/doctor.ts` preserves empty grouped results for modules without `doctor()`. |

---

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Command shape | ✅ Yes | One entry point: `cyberpunk doctor [--fix] [--json] [--verbose] [component flags]`. |
| Diagnostic contract | ✅ Yes | `DoctorCheck`, `DoctorResult`, `DoctorFixResult`, and grouped `DoctorRunResult.results` are used consistently. |
| Repair implementation | ✅ Yes | Repairs use narrow helpers and deterministic ordering rather than broad reinstall behavior. |
| Config inspection | ✅ Yes | `readConfigRaw()` preserves the read-first, non-mutating diagnostic flow. |
| File Changes table | ⚠️ Minor deviation | The implementation added `src/components/config-doctor.ts` and `src/components/theme-doctor.ts` helper modules beyond the original table, but the architectural intent is unchanged. |

---

### Issues Found

**CRITICAL — change-specific blockers (must fix before archive):**
- None.

**CRITICAL — unrelated repository-level issues (non-blocking for this change per request):**
- The full repository suite is still red in `tests/upgrade-mode.test.ts` (`2` failures).
- `git status --short` shows unrelated modified upgrade-area files in the working tree, including `src/commands/upgrade.ts` and `tests/upgrade-mode.test.ts`, so these failures are tracked as separate repo risks, not doctor-change blockers.

**WARNING** (should fix):
- No coverage threshold is configured, and overall repository coverage remains low.
- The design file’s File Changes table is slightly stale relative to the helper-module split.

**SUGGESTION** (nice to have):
- Promote the temporary verification harnesses for `ffmpeg missing` and `module without doctor()` into committed repository tests.
- Isolate the upgrade-path tests from unrelated dirty-worktree / repository-state assumptions.

---

### Verdict
**PASS WITH WARNINGS**

`toolkit-doctor-repair` is **ready to archive**. The change-specific verification gate is green: build and typecheck pass, doctor-focused repo tests pass, runtime/CLI checks pass, and all 14 spec scenarios now have execution evidence. The remaining red full-suite failures are unrelated repository risks outside this change’s scope.

---

### Session Stats
```text
context-mode -- session (2h 43m)

Without context-mode:  |########################################| 23.7 MB in your conversation
With context-mode:     |#                                       | 224.9 KB in your conversation

23.5 MB processed in sandbox, never entered your conversation. (99.1% reduction)
+102h 40m session time gained.

  ctx_batch_execute      10 calls   118.0 KB used
  ctx_execute            62 calls   54.7 KB used
  ctx_execute_file       4 calls    13.0 KB used
  ctx_fetch_and_index    1 call     3.2 KB used
  ctx_search             8 calls    31.6 KB used
  ctx_stats              7 calls    4.3 KB used

v1.0.89
```
