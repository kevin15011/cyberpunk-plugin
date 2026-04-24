# Exploration: macOS Readiness Audit

## Executive Summary

The `macos-support` change (still active, not archived) delivered the foundational macOS distribution path: darwin binaries in CI, install.sh darwin support, upgrade dispatch, and README documentation. However, **several gaps remain between "ships darwin binaries" and "macOS-ready end-to-end."** The most significant gaps are: unsigned binaries (Gatekeeper friction), no checksum validation in the binary upgrade path, no macOS-specific doctor checks, no quarantine handling during `cyberpunk upgrade`, and the `mac` preset omits tmux without documenting why.

## Current State

### What works today (macOS path)

| Area | Status | Evidence |
|------|--------|----------|
| **CI builds** | ✅ `build-darwin-x64` (macos-13) and `build-darwin-arm64` (macos-14) exist in release.yml | Workflow lines 161-279 |
| **Smoke tests** | ✅ Each darwin binary runs `./cyberpunk-darwin-* help` before publish | Workflow lines 187, 247 |
| **Checksums** | ✅ SHA256 fragments uploaded per-platform, combined in `checksums` job | Workflow lines 189-203, 249-263, 281-319 |
| **install.sh** | ✅ Detects darwin, builds `cyberpunk-darwin-{arch}`, downloads, attempts quarantine removal | Lines 106-128, 170-212 |
| **Quarantine removal** | ✅ `attempt_quarantine_removal()` runs `xattr -d com.apple.quarantine` with fallback guidance | install.sh lines 106-128 |
| **Config persistence** | ✅ `cyberpunk config init` + `config installMode binary` after install | install.sh lines 217-239 |
| **Upgrade dispatch** | ✅ `getPlatformAsset()` returns `cyberpunk-darwin-{arch}`, `runBinaryUpgrade()` downloads correct asset | upgrade.ts lines 115-122, 301-349 |
| **Sound playback** | ✅ Plugin uses `afplay` on darwin | cyberpunk-plugin.ts line 16-17 |
| **Platform detection** | ✅ `detectEnvironment()` returns `"darwin"` | src/platform/detect.ts line 41 |
| **Doctor platform checks** | ✅ ffmpeg, npm/bun, curl, git, opencode, playback all checked | src/commands/doctor.ts lines 180-218 |
| **mac preset** | ✅ `mac` preset defined: plugin + theme + sounds + context-mode + rtk | src/presets/definitions.ts lines 72-80 |
| **Tests** | ✅ Darwin asset naming, darwin x64/arm64 upgrade URLs, HOME cache isolation | tests/upgrade-mode.test.ts |

### What does NOT work or is missing

| Gap | Severity | Details |
|-----|----------|---------|
| **Unsigned binaries** | High | README documents Gatekeeper workaround but binaries remain unsigned. No signing/notarization pipeline. |
| **No checksum validation in upgrade** | Medium | `downloadAndReplaceBinary()` does NOT verify SHA256 against `checksums.txt`. Only `install.sh` mentions checksums for manual verification. |
| **No quarantine handling in upgrade** | Medium | `install.sh` removes quarantine on first install, but `runBinaryUpgrade()` (the in-app upgrade path) does NOT. Users who upgrade via `cyberpunk upgrade` get a fresh binary with quarantine attribute re-applied. |
| **No macOS-specific doctor checks** | Medium | Doctor checks ffmpeg, playback, etc. but has no `platform:gatekeeper`, `platform:xattr`, or `platform:codesign` checks. |
| **No release asset validation on install/upgrade** | Medium | Neither `install.sh` nor `runBinaryUpgrade()` verifies the downloaded binary passes a smoke test (`cyberpunk help`) before replacing the old one. |
| **mac preset omits tmux** | Low | The `mac` preset includes 5 components but not tmux. No warning explains why (likely because tmux on macOS often uses different plugin paths). |
| **No macOS CI runner coverage** | Low | Darwin binaries are built on macOS runners (macos-13/14) but only run `help` smoke test. No integration tests run on darwin in CI. |
| **ffmpeg via Homebrew path not validated** | Low | `brew install ffmpeg` is documented but `doctor` doesn't check if ffmpeg came from Homebrew vs other sources. |
| **`installMode: "repo"` stamped after TUI install** | Low | `src/commands/install.ts` line 73 stamps `installMode: "repo"` after any TUI install, even if the user installed via binary. This could cause upgrade dispatch confusion. |

## Affected Areas

- `.github/workflows/release.yml` — CI build jobs, smoke tests, checksum pipeline
- `install.sh` — quarantine removal, darwin download path, ffmpeg guidance
- `src/commands/upgrade.ts` — `downloadAndReplaceBinary()` lacks quarantine + checksum validation
- `src/commands/doctor.ts` — no macOS-specific platform checks
- `src/presets/definitions.ts` — `mac` preset warnings don't mention tmux omission rationale
- `src/commands/install.ts` — `installMode: "repo"` stamping after TUI install
- `README.md` — documents limitations but no verification tests for docs
- `openspec/changes/macos-support/` — still active, tasks 5.1-5.3 incomplete

## Approaches

### Approach A: Audit-only (recommended first slice)

Produce a comprehensive audit report identifying all gaps, their severity, and recommended fixes. No code changes.

- **Pros**: Zero risk, complete picture, informs prioritization of future hardening work
- **Cons**: Doesn't fix anything, user still has the same gaps
- **Effort**: Low (research + documentation only)

### Approach B: Audit + Critical Hardening

Audit plus fix the highest-severity gaps: quarantine handling in upgrade, checksum validation, and smoke-test-before-replace.

- **Pros**: Fixes the most dangerous gaps (quarantine + checksum) in one slice
- **Cons**: Larger scope, more testing needed, may uncover additional issues mid-implementation
- **Effort**: Medium

### Approach C: Full macOS Readiness

Everything in B plus: signing/notarization pipeline, macOS-specific doctor checks, macOS CI integration tests, preset refinements.

- **Pros**: Comprehensive macOS readiness
- **Cons**: Very large scope, requires Apple Developer certificate ($99/yr), significant CI changes
- **Effort**: High

## Recommendation

**Approach A (audit-only) as the first slice**, followed by a separate hardening change.

Rationale:
1. The `macos-support` change is still active with incomplete tasks (5.1-5.3). An audit clarifies what's actually missing vs what's just not manually validated.
2. The user explicitly wants to "verify mac readiness before improving the upgrade flow UX." An audit provides that verification baseline.
3. Several gaps (signing/notarization) require external investments (Apple Developer cert) that should be decided before implementation begins.
4. The audit can produce a prioritized hardening backlog with clear effort estimates for each gap.

### Recommended scope for the audit slice

1. **Gap inventory**: Catalog all macOS-specific gaps found in code review (done in this exploration)
2. **Severity classification**: Rate each gap by impact on macOS user experience
3. **Dependency analysis**: Identify which gaps block the upgrade flow UX improvement
4. **Hardening backlog**: Produce a prioritized list of follow-up changes with effort estimates
5. **Decision points**: Flag items requiring external decisions (Apple Developer cert, CI runner budget)

## Risks

- **Gatekeeper friction**: Unsigned binaries will continue to trigger warnings on first launch. This is a known limitation documented in README but not actively mitigated.
- **Quarantine re-application on upgrade**: Users who install via `install.sh` (quarantine removed) then upgrade via `cyberpunk upgrade` get a fresh downloaded binary with quarantine re-applied. They may need to repeat the Gatekeeper workaround.
- **No integrity verification**: Without checksum validation in the upgrade path, a corrupted or tampered binary download would silently replace the working binary.
- **macos-support change still active**: The existing change has incomplete tasks. The audit should clarify whether to close/archive it or fold remaining work into the new change.

## Ready for Proposal

**Yes.** The exploration is complete with a clear gap inventory, severity classification, and recommended approach. The orchestrator should proceed to `sdd-propose` to create a change proposal for the audit-only slice.
