# Verification Report: multi-agent-windows-installer

**Change**: `multi-agent-windows-installer`  
**Version**: N/A  
**Mode**: Standard verify (`strict_tdd: false`; RED/GREEN evidence checked from tasks/apply-progress)  
**Verifier**: `openai/gpt-5.5`  
**Date**: 2026-04-25  
**Rerun Context**: Rerun after fixing recurring repo-root literal `~/` root cause

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 34 |
| Tasks complete | 34 |
| Tasks incomplete | 0 |
| Requirements reviewed | 11 |
| Scenarios reviewed | 19 |

OpenSpec `tasks.md` is complete. Engram `sdd/multi-agent-windows-installer/tasks` remains stale and only lists Phases 1-3 plus "Phase 4-7: Remaining", but Engram `apply-progress` and OpenSpec tasks show Phases 1-7 complete plus the critical verify fix pass and tilde root-cause fix.

---

## Build & Tests Execution

**Focused regression test**: Passed

```bash
bun test ./tests/doctor-platform-helpers-regression.test.ts
```

Result: exit 0; 5 pass; 0 fail; 7 `expect()` calls; 1 file.

**Repo-root literal-home artifact guard**: Passed

```bash
git status --short './~'
```

Result: exit 0; no output. Filesystem check also reports `/home/kevinlb/cyberpunk-plugin/~` does not exist.

**Tests**: Passed

```bash
bun test
```

Result: exit 0; 597 pass; 0 fail; 1566 `expect()` calls; 47 files; 142.11s.

**Typecheck**: Passed

```bash
bun run typecheck
```

Result: exit 0; `tsc --noEmit` clean.

**Coverage**: Available; no configured threshold

```bash
bun test --coverage
```

Observed passing coverage rerun: exit 0; all files 71.22% funcs / 63.78% lines. `src/commands/doctor.ts` remains low at 26.67% funcs / 22.10% lines. One earlier coverage attempt during this rerun produced a transient coverage-only failure in the tmux idempotence test; the normal full suite is green and a subsequent coverage run completed successfully.

---

## Previous CRITICAL Findings Re-check

| Previous critical | Status | Evidence |
|-------------------|--------|----------|
| Doctor repair paths used raw HOME fallback/direct `which` instead of shared helpers | Resolved | `src/commands/doctor.ts` imports `getHomeDirAuto` and `isCommandOnPath`; `tests/doctor-platform-helpers-regression.test.ts` verifies no raw `process.env.HOME || process.env.USERPROFILE || "~"` pattern and no direct `execSync("which ...")` in doctor source. |
| Repo-root literal `~/` artifact existed | Resolved | `src/platform/paths.ts` ignores literal `~` for HOME/USERPROFILE; `tests/platform-paths.test.ts` covers HOME=`~` and USERPROFILE=`~`; `tests/plugin.ctx.test.ts` uses isolated temp HOME; `git status --short './~'` has no output; focused guard and full suite pass. |

---

## Spec Compliance Matrix

**Compliance summary**: 19/19 scenarios compliant, 0 failing, 0 untested.

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Detect Platform and Agent State | Native Windows with OpenCode available | `tests/platform-detect.test.ts`, `tests/detection-registry.test.ts`, `tests/platform-paths.test.ts` | COMPLIANT |
| Detect Platform and Agent State | Unverified Codex support remains unknown | `tests/detection-codex.test.ts` | COMPLIANT |
| Recommend Compatible Components | OpenCode plus RTK prerequisites recommends RTK | `tests/detection-recommend.test.ts` | COMPLIANT |
| Recommend Compatible Components | Claude without verified context-mode surface is withheld/explained | `tests/component-adapter.test.ts`, `tests/detection-recommend.test.ts` | COMPLIANT |
| Windows-Safe Entry Points | Windows dry-run shows plan with no side effects | `tests/install-routing.test.ts`, `tests/build-windows.test.ts` | COMPLIANT |
| Windows-Safe Entry Points | Shared path/shell abstraction leaves no repo-root literal-home artifacts | `tests/platform-paths.test.ts`, `tests/plugin.ctx.test.ts`, `tests/doctor-platform-helpers-regression.test.ts` | COMPLIANT |
| Safe Failure and Remediation | PowerShell/prerequisite blockage reports next remediation step | `tests/install-ps1.test.ts` | COMPLIANT |
| Agent-Aware Compatibility and Backward Compatibility | Existing OpenCode install flow remains default and available | `tests/install-routing.test.ts`, `tests/parse-args-target.test.ts`, `tests/plugin.ctx.test.ts`, existing regressions | COMPLIANT |
| Agent-Aware Compatibility and Backward Compatibility | Claude/Codex unsupported components are excluded with explanation | `tests/install-routing.test.ts`, `tests/component-adapter.test.ts`, `tests/detection-claude.test.ts`, `tests/detection-codex.test.ts` | COMPLIANT |
| Windows-Safe Planning Output | Windows plan renders target, components, prerequisite gaps, paths | `tests/install-routing.test.ts` | COMPLIANT |
| Multi-Agent State Persistence | Legacy OpenCode config loads safely | `tests/config-v2.test.ts`, `tests/config.test.ts` | COMPLIANT |
| Multi-Agent State Persistence | Windows/Claude/profile/compatibility state can be persisted | `tests/config-v2.test.ts` | COMPLIANT |
| Professional Segmented Guidance | Non-technical guidance uses safe defaults/professional copy | `tests/tui-copy-standards.test.ts`, TUI screen tests | COMPLIANT |
| Professional Segmented Guidance | Technical/admin flow exposes rationale, paths, remediation | `tests/tui-adapter-payload.test.ts`, `tests/doctor-routing.test.ts`, `tests/status-routing.test.ts` | COMPLIANT |
| Multi-Agent Diagnostics and Transparent Remediation | Unverifiable Claude/Codex support stays unknown/unsupported with no auto-fix | `tests/detection-claude.test.ts`, `tests/detection-codex.test.ts`, `tests/doctor-routing.test.ts` | COMPLIANT |
| Multi-Agent Diagnostics and Transparent Remediation | Missing Windows prerequisite reports blocker and remediation | `tests/install-ps1.test.ts`, `tests/doctor-routing.test.ts` | COMPLIANT |
| OpenCode Diagnostics Stay Backward Compatible | Existing OpenCode doctor checks still appear/behave | `tests/doctor.test.ts`, `tests/doctor-scenarios.test.ts` | COMPLIANT |
| Agent-Specific Registration Adapters | OpenCode registration preserves existing path/idempotent behavior | `tests/plugin-registration.test.ts`, `tests/plugin.ctx.test.ts`, `tests/opencode-config.test.ts` | COMPLIANT |
| Agent-Specific Registration Adapters | Claude/Codex registration does not run without verified adapter | `tests/install-routing.test.ts`, `tests/component-adapter.test.ts` | COMPLIANT |

---

## Correctness (Static — Structural Evidence)

| Requirement area | Status | Notes |
|------------------|--------|-------|
| Domain contracts | Implemented | `src/domain/environment.ts` defines precise unions/interfaces for targets, platform, shell, capabilities, detection, and recommendations. |
| Platform/path/shell helpers | Implemented | `src/platform/paths.ts` and `src/platform/shell.ts` exist; literal `~` HOME/USERPROFILE is normalized away before fallback; doctor uses helper-based lookup. |
| Detection registry | Implemented | OpenCode detector, conservative Claude detector, and Codex `unknown` detector are present and covered. |
| Component compatibility filtering | Implemented | Capability registry and recommendation tests cover supported/withheld components. |
| Config v2/backward compatibility | Implemented | `normalizeConfig()` defaults legacy config to OpenCode and preserves v2 state without mutation. |
| CLI/install/status/doctor routing | Implemented | Target/profile/mode parsing and routing tests exist. |
| Windows distribution | Implemented with deferred hardening | `build.ts`, release workflow, and `install.ps1` cover Windows x64; signing/ARM64/MSI remain deferred. |
| TUI professional copy | Implemented | `tests/tui-copy-standards.test.ts` passes and scans `src/tui` for disallowed symbol/emoticon-like glyphs. |
| Type precision | Acceptable | Core new domain/helper contracts remain precise. Static scan found no `any` usage in `src/domain/environment.ts`, `src/platform/paths.ts`, or `src/platform/shell.ts`. Existing localized `any` casts remain in legacy areas. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Central domain model | Yes | Implemented in `src/domain/environment.ts`. |
| Detection registry | Yes | Detectors are isolated; unsupported targets are conservative. |
| Component capability adapters | Yes | Capability registry preserves OpenCode defaults and withholds unverified Claude/Codex component installs. |
| Paths/commands abstraction | Yes | Shared helpers are used in doctor/upgrade/opencode paths; literal-home fallback root cause is covered by tests. |
| Professional no-emoticon TUI | Yes | TUI copy standard test passes. |
| Windows distribution | Mostly | x64 build/install artifacts are covered by tests; actual Windows runner evidence was not observed locally. |

---

## CRITICAL (must fix before archive)

None.

---

## WARNING (should fix or explicitly accept)

1. Hybrid artifact inconsistency remains: Engram `sdd/multi-agent-windows-installer/tasks` is stale while OpenSpec tasks and Engram apply-progress are current.
2. Coverage command is available and passed on rerun, but one coverage-only attempt was transiently red in the tmux idempotence test; normal `bun test` is green.
3. Doctor coverage remains low: `src/commands/doctor.ts` line coverage is 22.10%.
4. Windows CI execution was not observed locally; workflow/static tests exist, but a real Windows runner pass is still unverified in this environment.
5. Deferred release hardening remains: Windows ARM64 artifact, Authenticode signing/Defender reputation, and MSI/enterprise packaging are not implemented.
6. Claude/Codex remain detection-only; this matches scope but should stay explicit in release notes and UX.
7. Legacy CLI output in `src/cli/output.ts` still contains check/cross glyphs and Spanish strings; the TUI/no-emoticon requirement is green, but a global CLI copy cleanup would be separate follow-up if desired.

---

## SUGGESTION (follow-up)

1. Refresh Engram `sdd/multi-agent-windows-installer/tasks` so hybrid backends agree before archival.
2. Keep `tests/doctor-platform-helpers-regression.test.ts` as a permanent guard against raw HOME fallback/direct `which` regressions and literal-home artifacts.
3. Add more Windows-focused doctor `--fix`/remediation tests to raise `doctor.ts` coverage.
4. Validate the release workflow on an actual Windows runner before publishing the first Windows release.
5. Consider expanding the TUI copy standard to CLI text if the project wants the no-glyph/no-Spanish rule to apply beyond TUI screens.

---

## Specific Requested Confirmations

- **Previous CRITICAL items**: Both resolved. Doctor helper regression guard passes; repo-root `./~` artifact is absent and full suite is green.
- **`bun test`**: Confirmed passing — 597 pass, 0 fail, 1566 assertions, 47 files.
- **`bun run typecheck`**: Confirmed clean.
- **Coverage**: Feasible and run. Passing rerun produced 71.22% funcs / 63.78% lines; no threshold configured.
- **UI copy no emoticons/emojis**: Confirmed for TUI by `tests/tui-copy-standards.test.ts`; see warning for legacy CLI glyphs outside that TUI test scope.
- **No speculative Claude/Codex installation**: Confirmed. Claude is conservative detection only; Codex returns `unknown`; component routing withholds unsupported/unverified installs; no Claude/Codex registration adapter runs without verification.
- **OpenCode backward compatibility**: Confirmed structurally and by tests covering default target `opencode`, legacy flag parsing/routing, config v1 normalization, and OpenCode registration.

---

## Verdict

**PASS WITH WARNINGS**

The previous blocking repo-root literal-home artifact issue is resolved, full tests and typecheck pass, and all 19 spec scenarios have passing behavioral evidence. Archive can proceed if the remaining warnings are accepted, especially the stale Engram tasks artifact and deferred Windows release hardening.

---

## Session Stats

context-mode processed approximately 2.4 MB in sandbox with about 96.4% context reduction during this verification session.
