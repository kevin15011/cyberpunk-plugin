# Verification Report

**Change**: macos-support  
**Mode**: Standard  
**Date**: 2026-04-21

---

## Current-State Summary

### Implemented and validated
- `tests/upgrade-mode.test.ts` passes in isolation (`24 pass, 0 fail`), including darwin asset-name regex coverage, darwin x64/arm64 binary-upgrade URL assertions, and a regression guard for HOME-sensitive module caching.
- Added a regression test covering cross-file HOME/config cache pollution; `tests/plugin-registration.test.ts` + `tests/upgrade-mode.test.ts` now pass together (`30 pass, 0 fail`).
- `bun test` now passes for the full suite (`124 pass, 0 fail`).
- `bun run tsc --noEmit` now runs successfully after adding a local `typescript` dev dependency.
- `install.sh` parses successfully (`bash -n install.sh`).
- Runtime installer simulation confirmed darwin URL construction and binary install-mode persistence for both `Darwin/arm64` and `Darwin/x86_64`:
  - `.../releases/latest/download/cyberpunk-darwin-arm64`
  - `.../releases/latest/download/cyberpunk-darwin-x64`
- `bun run build` succeeds and produces `./cyberpunk`.
- README documents macOS binaries, Gatekeeper workaround, ffmpeg guidance, and deferred signing/notarization/macOS CI scope.

### Implemented but not fully validated
- `.github/workflows/release.yml` contains standalone `build-darwin-x64` and `build-darwin-arm64` jobs using Bun cross-compilation and `allowUpdates: true`, but there is no passing release-validation test proving those jobs have published darwin assets from this change.
- `install.sh` has the darwin path implemented and simulated successfully, but no real macOS smoke run has been recorded yet.
- `src/config/load.ts`, `src/config/save.ts`, and `src/commands/upgrade.ts` now resolve HOME-dependent paths at runtime instead of caching them at module import time, fixing the shared-state suite failure while preserving the existing asset contract.

### Not yet complete / manual follow-up
- Tasks `5.1`, `5.2`, and `5.3` remain unchecked in `openspec/changes/macos-support/tasks.md`.
- Public GitHub latest release currently exposes only `cyberpunk-linux-arm64` and `cyberpunk-linux-x64`; darwin assets are not yet visible on the live release page.
- Real macOS installer and `cyberpunk upgrade` smoke checks are still pending.

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total (all listed) | 21 |
| Tasks complete | 16 |
| Tasks incomplete | 5 |
| In-scope tasks complete | 16 / 19 |

### Incomplete tasks
- [ ] 5.1 Manual: run `install.sh` on a darwin machine (or simulate curl download) to verify asset URL resolves
- [ ] 5.2 Manual: run `cyberpunk upgrade` on darwin to verify `getPlatformAsset()` returns darwin-named asset and downloads correctly
- [ ] 5.3 Confirm release page shows all four assets: linux-x64, linux-arm64, darwin-x64, darwin-arm64
- [ ] Signing/notarization follow-up (explicitly deferred / out of scope)
- [ ] macOS CI validation follow-up (explicitly deferred / out of scope)

---

## Build & Tests Execution

**Build**: ✅ Passed  
Command: `bun run build`

**Targeted macOS tests**: ✅ Passed  
Command: `bun test tests/upgrade-mode.test.ts`
- Result: `23 pass, 0 fail`

**Full suite**: ✅ Passed  
Command: `bun test`
- Result: `124 pass, 0 fail`
- Root cause fixed: HOME-dependent config/binary paths are now computed at call time, so earlier module imports no longer poison later upgrade-mode tests.

**Type check**: ✅ Passed  
Command: `bun run tsc --noEmit`
- Result: passes with no diagnostics after adding local `typescript` to `devDependencies`.

**Coverage**: ⚠️ Available but failing due suite failure  
Command: `bun test --coverage`
- Result: `119 pass, 4 fail`
- Reported totals before exit: `All files 37.80% lines`, `src/commands/upgrade.ts 20.15% lines`
- No configured threshold in `openspec/config.yaml`

**Installer syntax**: ✅ Passed  
Command: `bash -n install.sh`

---

## Spec Compliance Matrix

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Cross-Platform Release Assets | macOS assets are published | No passing runtime/release validation test; latest public release still lacks darwin assets | ❌ UNTESTED |
| Cross-Platform Release Assets | Naming stays URL-compatible | `tests/upgrade-mode.test.ts > getPlatformAsset (from upgrade module) > returns expected format matching cyberpunk-{os}-{arch}` | ✅ COMPLIANT |
| Installer Reuses Shared Release URL Pattern | Apple Silicon install | Runtime installer simulation confirmed `.../cyberpunk-darwin-arm64`, but no project test covers this scenario | ⚠️ PARTIAL |
| Installer Reuses Shared Release URL Pattern | Intel Mac install | Runtime installer simulation confirmed `.../cyberpunk-darwin-x64`, but no project test covers this scenario | ⚠️ PARTIAL |
| Documentation States macOS Constraints and Deferrals | README explains macOS prerequisites | README contains Gatekeeper + ffmpeg guidance, but no test covers docs behavior | ⚠️ PARTIAL |
| Documentation States macOS Constraints and Deferrals | Deferred work is explicit | README current limitations section states signing/notarization/macOS CI deferrals, but no test covers docs behavior | ⚠️ PARTIAL |
| Apply Upgrade | Successful repo upgrade | Existing repo-path tests pass, but scenario expects newer remote and actual upgrade, not just up-to-date branch behavior | ⚠️ PARTIAL |
| Apply Upgrade | Successful Linux binary upgrade | No change-specific passing test identified in this verify run | ❌ UNTESTED |
| Apply Upgrade | Successful macOS binary upgrade | `tests/upgrade-mode.test.ts > binary mode on darwin downloads the darwin x64 release asset`; `... > binary mode on darwin downloads the darwin arm64 release asset` | ✅ COMPLIANT |
| Apply Upgrade | Binary already current | `tests/upgrade-mode.test.ts > binary check stays informational when semver matches` validates `checkBinaryUpgrade`, not full `runUpgrade` scenario status | ⚠️ PARTIAL |
| Apply Upgrade | Binary download failure | No passing test identified in current suite for macOS-support delta | ❌ UNTESTED |
| Apply Upgrade | Config preserved during upgrade | `tests/upgrade-mode.test.ts > binary config dispatches to binary upgrade path` passes in isolation and checks `installMode` remains `binary`, but does not prove full config identity in both repo and binary modes | ⚠️ PARTIAL |

**Compliance summary**: 2 / 12 scenarios fully compliant by passing test evidence; 7 partial; 3 untested.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Cross-Platform Release Assets | ✅ Implemented | `release.yml` adds `build-darwin-x64` and `build-darwin-arm64`, both upload `cyberpunk-darwin-*` assets with `allowUpdates: true`. |
| Installer Reuses Shared Release URL Pattern | ✅ Implemented | `install.sh` normalizes `uname -s` / `uname -m`, builds `cyberpunk-${OS}-${ARCH}`, keeps Alpine special-case Linux-only, and downloads from `/releases/latest/download/${BINARY_NAME}`. |
| Documentation States macOS Constraints and Deferrals | ✅ Implemented | README documents macOS binary availability, Gatekeeper caveat, ffmpeg guidance, and explicit deferred limitations. |
| Apply Upgrade (macOS delta) | ✅ Implemented | `getPlatformAsset()` already supports darwin; tests assert darwin asset naming and download URLs; implementation change is comment-only as designed. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Add standalone darwin jobs mirroring Linux jobs | ✅ Yes | Workflow uses dedicated darwin jobs rather than a refactor to a matrix. |
| Keep deterministic `cyberpunk-{os}-{arch}` URL contract | ✅ Yes | Workflow, installer, and upgrade helper all use the same asset naming pattern. |
| Preserve existing upgrade helper | ✅ Yes | `getPlatformAsset()` behavior is unchanged; only contract documentation/tests were tightened. |
| Ship unsigned MVP and defer trust work | ✅ Yes | README explicitly documents unsigned-binary behavior and defers signing/notarization/macOS CI. |

---

## Issues Found

**WARNING**
- Manual macOS smoke checks (`5.1`, `5.2`) are still pending.
- Release-page validation (`5.3`) is still pending, and the latest public release currently shows only Linux assets.
- Most spec scenarios still lack passing automated tests or full runtime validation evidence.

**SUGGESTION**
- Add a real installer-focused test harness for `install.sh` URL resolution and config persistence.
- Add release-validation automation (or a documented manual-release checklist) before archive.

---

## Verdict

**BLOCKED BY EXTERNAL VALIDATION**

All in-repo verification blockers addressed in this apply batch now pass locally (`bun test`, `bun run tsc --noEmit`, `bun run build`, `bash -n install.sh`). Final verification still depends on external/manual macOS smoke checks and confirming published darwin assets on the live release page.
