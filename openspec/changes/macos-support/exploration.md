# Exploration: macOS Support

## Executive Summary

macOS can be supported with **minimal changes** — the existing install URL pattern and upgrade code already handle `darwin` platform detection. The only missing piece is building macOS binaries in CI, which Bun's cross-compilation feature enables from the existing Linux runners without requiring macOS CI machines.

## Current State

### How the system works today

1. **Binary builds** (`.github/workflows/release.yml`):
   - `build` job on `ubuntu-latest` → `bun run build` → produces `cyberpunk-linux-x64`
   - `build-linux-arm64` job on `ubuntu-latest` → `bun build --compile` → produces `cyberpunk-linux-arm64`
   - No macOS builds exist

2. **Install script** (`install.sh`):
   - Detects OS via `uname -s` and normalizes to lowercase
   - Has explicit Linux-only download path (line 26: `if [ "$OS" = "linux" ]`)
   - Constructs `BINARY_NAME="cyberpunk-${OS}-${ARCH}"`
   - Downloads from `https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}`

3. **Upgrade code** (`src/commands/upgrade.ts`):
   - `getPlatformAsset()` already maps `darwin` → `cyberpunk-darwin-{arch}`
   - Binary download URL pattern is platform-agnostic
   - Tests already verify `darwin` in the regex: `/^cyberpunk-(linux|darwin)-(x64|arm64)$/`

4. **Plugin runtime** (`cyberpunk-plugin.ts`, `src/components/plugin.ts`):
   - Already detects `IS_MAC = process.platform === "darwin"`
   - Uses `afplay` on macOS, `paplay` on Linux

5. **Sound generation** (`src/components/sounds.ts`):
   - Uses `ffmpeg` which is cross-platform
   - No OS-specific code paths

6. **README.md**:
   - States "Linux x64/arm64 — Pre-built binary available"
   - States "macOS/other — Build from source with bun"

### Current OS/arch assumptions

| Dimension | Current Value | Notes |
|-----------|--------------|-------|
| OS detection | `uname -s` → lowercase | Already returns `darwin` on macOS |
| Arch detection | `uname -m` → x64/arm64 | Already returns `arm64` on Apple Silicon |
| Binary naming | `cyberpunk-{os}-{arch}` | Already format-compatible |
| Download URL | `.../latest/download/{BINARY_NAME}` | Already platform-agnostic |
| Build targets | `bun build --compile` (host) | Produces ELF on Linux, would produce Mach-O on macOS |
| CI runners | `ubuntu-latest` only | No macOS runners configured |

## Key Questions Answered

### 1. Can macOS use the SAME binary as current platforms?

**No — but it doesn't need to.** A Linux ELF binary cannot run on macOS (requires Mach-O format). However, the **same source code** produces macOS binaries via Bun's cross-compilation:

```bash
# From existing Linux CI runner:
bun build --compile --target=bun-darwin-arm64 ./src/index.ts --outfile cyberpunk-darwin-arm64
bun build --compile --target=bun-darwin-x64 ./src/index.ts --outfile cyberpunk-darwin-x64
```

Bun 1.3.12 supports these cross-compilation targets natively from Linux runners.

### 2. Can macOS use the SAME install URL?

**Yes.** The URL pattern is already platform-agnostic:
```
https://github.com/kevin15011/cyberpunk-plugin/releases/latest/download/cyberpunk-{os}-{arch}
```

Only the `{os}` and `{arch}` segments change. Both `install.sh` and `upgrade.ts` already construct the correct asset name for darwin. No URL logic changes needed.

## What Blocks macOS Support Today

| Blocker | Location | Severity |
|---------|----------|----------|
| No macOS binaries in GitHub Releases | `.github/workflows/release.yml` | **Critical** |
| `install.sh` Linux-only guard | `install.sh` line 26 | **Critical** |
| README says "build from source" | `README.md` | Documentation |
| No Gatekeeper code signing | Build pipeline | **Medium** (usability) |

## Approaches

### Approach A: Cross-compile from Linux CI (Recommended)

Add two new CI jobs that cross-compile macOS binaries from the existing `ubuntu-latest` runner.

| Aspect | Details |
|--------|---------|
| **Pros** | No macOS runners needed; fastest path; same CI cost; Bun officially supports it |
| **Cons** | Cannot codesign from Linux (Gatekeeper warnings on first run); cannot test execution on macOS in CI |
| **Effort** | Low — 2 new CI jobs + 1 line change in install.sh |
| **CI changes** | Add `build-macos-arm64` and `build-macos-x64` jobs using `--target=bun-darwin-*` |

### Approach B: Add macOS Runners

Add `macos-latest` runners to build natively.

| Aspect | Details |
|--------|---------|
| **Pros** | Can codesign binaries; can run tests on macOS; native builds |
| **Cons** | Slower CI (macOS runners are slower); higher GitHub Actions cost; more complex workflow |
| **Effort** | Medium — new runner config + codesign setup + potential Apple Developer cert |
| **CI changes** | Add `macos-latest` jobs, configure codesign, manage certificates |

### Approach C: Hybrid — Cross-compile + Separate Signing Step

Cross-compile from Linux, then codesign in a separate macOS runner or manual step.

| Aspect | Details |
|--------|---------|
| **Pros** | Fast builds; codesigned binaries |
| **Cons** | Two-step process; requires Apple Developer certificate ($99/yr) |
| **Effort** | Medium |

## Recommendation

**Approach A (cross-compile from Linux)** as the minimum viable path:

1. Add two CI jobs using `--target=bun-darwin-arm64` and `--target=bun-darwin-x64`
2. Remove the Linux-only guard in `install.sh`
3. Update README to reflect macOS binary availability
4. Defer Gatekeeper signing to a follow-up change (users can manually `codesign` or use `xattr -d` to bypass)

This delivers working macOS support in the smallest possible delta. Codesign can be added later when the Apple Developer certificate investment is justified.

## Unknowns / Requires Verification

1. **Bun cross-compile reliability**: The `--target=bun-darwin-*` flags are documented but not yet tested with this codebase. The `@clack/prompts` dependency and `child_process` calls need verification on cross-compiled macOS binaries.

2. **`process.platform` in cross-compiled binary**: When cross-compiling from Linux with `--target=bun-darwin-arm64`, does `process.platform` correctly return `"darwin"` at runtime? (Bun docs suggest yes, but should be verified.)

3. **ffmpeg on macOS**: Sound generation requires ffmpeg. macOS users would need `brew install ffmpeg`. The install script should check for this on darwin too (currently only checks on Linux).

4. **`afplay` availability**: The plugin uses `afplay` for sound playback on macOS. This is a built-in macOS utility — should always be available, but worth confirming.

5. **Install script TUI launch**: The `install.sh` script launches the TUI after binary install. `@clack/prompts` TUI behavior on macOS terminal emulators should be verified.

## Affected Files

| File | Change Type | Description |
|------|-------------|-------------|
| `.github/workflows/release.yml` | Add jobs | Add `build-macos-arm64` and `build-macos-x64` cross-compile jobs |
| `install.sh` | Modify | Remove Linux-only guard, allow darwin to proceed |
| `README.md` | Update | Update requirements to include macOS binary availability |
| `src/commands/upgrade.ts` | No change | Already handles darwin correctly |
| `src/components/sounds.ts` | No change | ffmpeg is cross-platform |
| `src/components/plugin.ts` | No change | Already has `IS_MAC` / `afplay` path |
| `cyberpunk-plugin.ts` | No change | Already has `IS_MAC` / `afplay` path |

## Risks

1. **Gatekeeper warnings**: Unsigned macOS binaries trigger "unidentified developer" warnings. Users must right-click → Open or use `xattr -d com.apple.quarantine`. This is a usability friction point.

2. **Cross-compile correctness**: Bun's cross-compilation is relatively new. Edge cases with native APIs (like `child_process` spawning `ffmpeg`) may behave differently than native builds.

3. **Intel Mac support declining**: `darwin-x64` targets a shrinking user base. The build cost is minimal but the testing burden exists.

4. **No macOS CI testing**: Without macOS runners, we cannot run tests on macOS in CI. Bugs specific to macOS would only be caught by users.

## Ready for Proposal

**Yes.** The investigation is complete with clear answers to both key questions:
- Same binary: No (different executable format), but same source via cross-compilation
- Same URL: Yes (URL pattern is already platform-agnostic)

The recommended path (Approach A) is low-effort and unblocks macOS users immediately.
