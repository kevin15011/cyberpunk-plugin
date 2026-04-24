## Verification Report

**Change**: release-install-polish
**Version**: N/A
**Mode**: Standard

---

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 19 |
| Tasks complete | 19 |
| Tasks incomplete | 0 |

All tasks in `openspec/changes/release-install-polish/tasks.md` are marked complete.

---

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ bun run build
$ bun run build.ts
  [22ms]  bundle  1 modules
 [356ms] compile  ./cyberpunk
Binary built: ./cyberpunk
```

**Type Check**: ✅ Passed
```text
$ bun run tsc --noEmit
(no output)
```

**Tests**: ✅ 270 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
bun test v1.3.12 (700fc117)

 270 pass
 0 fail
 739 expect() calls
Ran 270 tests across 22 files. [3.54s]
```

**Coverage**: 51.14% lines / threshold: 0% → ✅ Above threshold
```text
bun test --coverage
All files | % Funcs 56.43 | % Lines 51.14
270 pass, 0 fail
```

**Focused change tests**: ✅ Passed
```text
tests/install-script.test.ts: 2/2 passed
tests/release-workflow.test.ts: 2/2 passed
tests/readme-release-install.test.ts: 3/3 passed
```

**Workflow lint tooling**: ⚠️ Not available locally
```text
actionlint=false
gh=false
```

---

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Standalone Installer Guidance Summary | Shell-aware PATH help for missing binary path | `tests/install-script.test.ts > surfaces ffmpeg follow-up guidance and macOS quarantine fallback in the install summary` + `tests/install-script.test.ts > uses shell-aware PATH guidance, avoids duplicate export messaging, and prints verification summary` | ⚠️ PARTIAL |
| Standalone Installer Guidance Summary | No duplicate PATH export added | `tests/install-script.test.ts > uses shell-aware PATH guidance, avoids duplicate export messaging, and prints verification summary` | ✅ COMPLIANT |
| Standalone Installer Dependency and macOS First-Run Guidance | Missing ffmpeg is surfaced as follow-up guidance | `tests/install-script.test.ts > surfaces ffmpeg follow-up guidance and macOS quarantine fallback in the install summary` | ✅ COMPLIANT |
| Standalone Installer Dependency and macOS First-Run Guidance | macOS quarantine removal falls back to guidance | `tests/install-script.test.ts > surfaces ffmpeg follow-up guidance and macOS quarantine fallback in the install summary` | ✅ COMPLIANT |
| Release Asset Validation and Checksums | Release succeeds with validated assets | `tests/release-workflow.test.ts > every produced binary is smoke tested before checksum generation and release upload` + `tests/release-workflow.test.ts > checksum publication depends on all smoke-gated binary jobs completing` | ✅ COMPLIANT |
| Release Asset Validation and Checksums | Smoke test failure blocks publish | `tests/release-workflow.test.ts > every produced binary is smoke tested before checksum generation and release upload` + `tests/release-workflow.test.ts > checksum publication depends on all smoke-gated binary jobs completing` | ✅ COMPLIANT |

**Compliance summary**: 5/6 scenarios compliant

---

### Correctness (Static — Structural Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Standalone Installer Guidance Summary | ✅ Implemented | `install.sh` detects shell/profile, avoids duplicate PATH exports, emits shell-aware guidance, and prints `Verify install: cyberpunk help` in the summary. |
| Standalone Installer Dependency and macOS First-Run Guidance | ✅ Implemented | `install.sh` emits ffmpeg follow-up guidance, attempts guarded quarantine removal on macOS, and includes manual fallback text when needed. |
| Release Asset Validation and Checksums | ✅ Implemented | `.github/workflows/release.yml` now smoke-tests all four produced binaries before checksum/release steps, generates checksum fragments per job, and uploads an aggregated `checksums.txt` asset. |

---

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Print shell-aware guidance only | ✅ Yes | `install.sh` prints profile-specific guidance and does not mutate shell profiles. |
| Guarded quarantine removal in `install.sh` | ✅ Yes | `attempt_quarantine_removal()` guards `xattr` and emits fallback guidance. |
| Run binary-level smoke tests before asset upload | ✅ Yes | Each binary-producing workflow job runs a smoke test before checksum generation and release upload. |
| Publish `checksums.txt` asset | ✅ Yes | Workflow aggregates checksum fragments and uploads a single manifest asset. |

---

### Issues Found

**CRITICAL** (must fix before archive):
None

**WARNING** (should fix):
- Installer scenario coverage is still split across two passing tests; there is not yet a single automated test that exercises the missing-PATH branch and also asserts the verification command in the same run.
- `actionlint` and `gh workflow lint` were unavailable in the local verification environment, so workflow validation relied on passing workflow-structure tests plus source inspection rather than a dedicated workflow linter.

**SUGGESTION** (nice to have):
- Add one installer test that covers missing PATH guidance and the final verification summary together to move the remaining partial scenario to fully compliant.

---

### Verdict
PASS WITH WARNINGS

The change is behaviorally verified with passing build, type-check, full test suite, coverage, and focused workflow/install tests. No critical archive blockers remain, so `release-install-polish` is ready to archive, with only non-blocking test/linting coverage gaps noted above.
