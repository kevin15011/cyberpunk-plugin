# Exploration: release-install-polish

## Executive Summary

The cyberpunk-plugin install/release surface is **functional but rough around the edges**. After 8 archived slices (doctor/repair, tmux component, install presets, WSL/mac presets, repo test stabilization, preset preflight guidance, sound extension fix, installer upgrade/release fix), the core install flows work but exhibit several user-facing friction points that don't require architectural redesign to fix. The highest-value polish targets are: **post-install PATH guidance**, **macOS Gatekeeper UX**, **install.sh ffmpeg guidance**, **upgrade UX feedback**, and **release asset validation gaps**.

## Current Install & Upgrade Flows

### Binary install path (curl → install.sh)

1. `curl -fsSL .../install.sh | bash` — downloads script from raw GitHub
2. Script detects OS/arch, checks for `ffplay`, downloads binary from GitHub Releases
3. Binary installs to `~/.local/bin/cyberpunk`
4. Runs `cyberpunk config init` + `cyberpunk config installMode binary`
5. Verifies `installMode=binary` persisted
6. Checks PATH — prints export line if `~/.local/bin` not in PATH
7. Launches `cyberpunk tui` for component selection

### Repo install path (git clone → build)

1. User clones repo, runs `bun install && bun run build`
2. Runs `./cyberpunk tui` or `cyberpunk install --preset X`
3. `runInstall()` stamps `installMode: "repo"` in config after success

### Upgrade paths

- **Binary mode**: `cyberpunk upgrade` → fetches latest release tag from GitHub API → downloads matching platform asset → atomic rename over existing binary
- **Repo mode**: `cyberpunk upgrade` → `git fetch origin main` → `git diff --name-only` → backs up changed files → `git pull origin main`
- **Check only**: `cyberpunk upgrade --check` → compares versions without downloading

### Post-install UX

- TUI launches automatically after binary install
- Component install results shown via `formatInstallResults()` — per-component success/error/skipped
- No post-install summary of what was configured, what needs attention, or next steps
- No "verify your install" step — user must run `cyberpunk doctor` separately

## User Friction Analysis

### 1. PATH guidance (install.sh lines 83-91) — **HIGH IMPACT**

**Current behavior**: If `~/.local/bin` is not in PATH, prints the export line but does NOT:
- Detect which shell the user runs (bash/zsh/fish)
- Offer to append to the correct profile file
- Verify the PATH after the user adds it
- Warn that the binary won't work until the shell is restarted

**Impact**: First-time users on fresh machines (especially macOS with zsh) will download the binary, see the note, but not know which file to edit. The binary becomes unusable until they figure it out.

**Friction level**: High — blocks all subsequent usage

### 2. macOS Gatekeeper (unsigned binary) — **HIGH IMPACT**

**Current behavior**: README mentions "use Finder → right-click → Open once" but:
- `install.sh` does NOT detect macOS or warn about Gatekeeper
- Binary download via `curl` triggers quarantine attribute (`com.apple.quarantine`)
- First run fails with "cyberpunk cannot be opened because the developer cannot be verified"
- No automated `xattr -d com.apple.quarantine` attempt
- No guidance printed at install time

**Impact**: Every macOS user hits this wall. The README workaround requires the user to:
1. Know the binary failed because of Gatekeeper (error message is cryptic)
2. Open Finder, navigate to `~/.local/bin/`
3. Right-click → Open → confirm dialog

**Friction level**: High — complete blocker on macOS until resolved

### 3. ffmpeg warning (install.sh lines 24-37) — **MEDIUM IMPACT**

**Current behavior**: Checks for `ffplay`, prints a generic warning with platform-specific install hints. But:
- Warning is printed BEFORE binary download — user might miss it in the output stream
- No distinction between "you need this for sounds" vs "this is critical"
- No post-install verification that sounds actually work
- `cyberpunk doctor` catches this, but only if the user runs it

**Impact**: Sounds fail silently on first use. User doesn't know why.

**Friction level**: Medium — degrades experience but doesn't block usage

### 4. WSL quirks — **MEDIUM IMPACT**

**Current behavior**: 
- `detect.ts` has `isWSL()` detection
- WSL preset exists with appropriate component selection
- But `install.sh` does NOT auto-detect WSL and suggest the WSL preset
- User lands in TUI and must know to pick WSL preset

**Impact**: WSL users might pick `full` preset and get context-mode/rtk which they don't need inside WSL.

**Friction level**: Medium — suboptimal defaults, not a blocker

### 5. Release asset expectations — **MEDIUM IMPACT**

**Current behavior**:
- `release.yml` builds 4 platform binaries (linux-x64, linux-arm64, darwin-x64, darwin-arm64)
- All builds run on `ubuntu-latest` runners
- Darwin binaries are cross-compiled via `--target=bun-darwin-x64/arm64`
- **No post-build validation**: binaries are uploaded without testing they actually run
- **No checksum generation**: no SHA256 sums published alongside releases
- **No release notes automation**: `generateReleaseNotes: true` produces generic GitHub auto-notes
- **No smoke test**: no step that downloads and runs the binary to verify it starts

**Impact**: A broken binary could be published and all install.sh users would download it. No integrity verification exists.

**Friction level**: Medium — reliability concern, not a user-facing blocker until something breaks

### 6. Upgrade UX feedback — **LOW-MEDIUM IMPACT**

**Current behavior**:
- `cyberpunk upgrade` downloads and replaces silently
- Result shows version change: `v1.2.0 → v1.3.0`
- No "what changed" summary
- No post-upgrade doctor run suggestion
- No config migration awareness (schema version is `1` and hasn't changed, but future versions might)

**Impact**: Users don't know what they got in the upgrade.

**Friction level**: Low-Medium — nice-to-have, not a blocker

## Post-Install Verification: What Exists vs What's Missing

### Already exists

| Capability | Where | Coverage |
|---|---|---|
| `cyberpunk status` | `src/commands/status.ts` | Per-component installed/available/error |
| `cyberpunk doctor` | `src/commands/doctor.ts` | Platform deps, config shape, plugin registration, theme activation, sounds files, context-mode routing/MCP, rtk routing/registration, tmux config block |
| `cyberpunk doctor --fix` | `src/commands/doctor.ts` | Auto-repair for most checks |
| `cyberpunk upgrade --check` | `src/commands/upgrade.ts` | Version comparison |
| `buildPresetPreflight()` | `src/commands/preflight.ts` | Pre-install dependency + readiness check |
| installMode verification | `install.sh` lines 74-81 | Verifies `installMode=binary` persisted |
| PATH check | `install.sh` lines 83-91 | Detects if `~/.local/bin` is in PATH |

### Missing

| Capability | Impact | Effort |
|---|---|---|
| **Post-install verification step** — run a subset of doctor checks automatically after install | High — catches issues before user notices | Low |
| **macOS quarantine removal** — `xattr -d com.apple.quarantine` after binary download on darwin | High — eliminates Gatekeeper friction | Low |
| **Shell-aware PATH setup** — detect bash/zsh/fish, offer to append to correct profile | Medium — reduces first-run friction | Low |
| **Release smoke test** — download and run binary in CI after build | Medium — catches broken releases early | Low |
| **Release checksums** — generate SHA256 sums for release assets | Low-Medium — integrity verification | Low |
| **"What's new" after upgrade** — show changelog or release notes | Low — user experience polish | Low |
| **Post-upgrade doctor suggestion** — prompt user to run `cyberpunk doctor` after upgrade | Low — catches drift | Trivial |
| **install.sh WSL auto-detection** — suggest WSL preset when running inside WSL | Low — better defaults | Low |
| **ffmpeg post-install sound test** — actually play a sound to verify ffmpeg works | Low — catches ffmpeg path issues | Low |

## Value Analysis: What Delivers Most Without Redesigning Distribution

### Tier 1: High value, low effort, no architecture changes

| Fix | What it does | Why it matters |
|---|---|---|
| **macOS quarantine removal in install.sh** | Add `xattr -d com.apple.quarantine` after binary download on darwin | Eliminates the #1 macOS blocker — zero user action needed |
| **Post-install verification** | After TUI install completes, run a lightweight check (ffmpeg, plugin file, theme file) and show summary | Catches issues before user notices; uses existing `collectStatus()` |
| **Shell-aware PATH setup offer** | Detect shell, offer to append `export PATH` to `~/.zshrc` or `~/.bashrc` | Reduces first-run friction on fresh machines |

### Tier 2: Medium value, low effort

| Fix | What it does | Why it matters |
|---|---|---|
| **Release smoke test in CI** | After building each binary, download and run `./cyberpunk --help` to verify it starts | Catches broken cross-compiled binaries before users download them |
| **Release checksums** | Generate SHA256 sums in CI, publish as release artifact | Enables integrity verification; standard practice |
| **Better ffmpeg guidance in install.sh** | Move ffmpeg warning to AFTER binary download, make it more prominent, add "run `cyberpunk doctor` to verify" | Users actually see and act on the warning |

### Tier 3: Nice-to-have polish

| Fix | What it does | Why it matters |
|---|---|---|
| **WSL auto-detection in install.sh** | Detect WSL, suggest `--preset wsl` or auto-select it | Better defaults for WSL users |
| **"What's new" after upgrade** | Fetch release notes from GitHub API, show summary | Users know what they got |
| **Post-upgrade doctor suggestion** | Print "Run `cyberpunk doctor` to verify your setup" after upgrade | Catches config drift |

## Safe Scope Boundaries for First Slice

### IN scope (recommended first slice)

| Capability | Boundary |
|---|---|
| **macOS quarantine removal** | `install.sh` only — add `xattr` call after binary download, guarded by `uname -s = Darwin` |
| **Post-install verification** | `install.sh` + reuse existing `cyberpunk status` — run after TUI exits, show summary of what succeeded/failed |
| **Shell-aware PATH setup offer** | `install.sh` only — detect shell from `$SHELL`, offer to append to correct profile file (with user confirmation) |
| **Release smoke test** | `.github/workflows/release.yml` only — add step after each build to verify binary starts |
| **Release checksums** | `.github/workflows/release.yml` only — generate SHA256, attach as release artifact |
| **Improved ffmpeg guidance** | `install.sh` only — reposition warning, make it more prominent |

### OUT of scope (explicitly deferred)

| Capability | Reason |
|---|---|
| **Binary signing/notarization** | Requires Apple developer certificate, CI key management — architectural change |
| **Distribution via Homebrew/npm/apt** | New distribution channels — redesign from scratch |
| **Auto-install ffmpeg** | Platform-specific, requires sudo, beyond installer scope |
| **Config schema migration** | No current need — schema version is stable at 1 |
| **Interactive post-install wizard** | Too complex — simple status summary is enough for now |
| **Release notes generation** | GitHub's auto-notes are adequate for now |
| **WSL bootstrap automation** | Beyond install polish — separate feature |

## Affected Files

| File | Change Type | Risk |
|---|---|---|
| `install.sh` | Modify — add macOS quarantine removal, PATH setup offer, post-install verification, improved ffmpeg guidance | Low — shell script, well-isolated changes |
| `.github/workflows/release.yml` | Modify — add smoke test steps, checksum generation | Low — CI-only, doesn't affect runtime |
| `README.md` | Modify — update macOS notes, document new install behavior | Trivial — documentation only |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **`xattr` not available on all macOS versions** | Low | Guard with `command -v xattr`; skip if unavailable |
| **PATH append corrupts profile file** | Low | Only append if line not already present; use temp file + rename |
| **Post-install verification slows down install** | Low | Only runs `cyberpunk status` which is fast (<500ms) |
| **Smoke test fails on CI due to missing deps** | Low | Test only `--help` flag which requires no deps |
| **Checksum generation breaks existing release flow** | Low | Add as separate step; doesn't replace existing artifact upload |
| **Scope creep into signing/notarization** | Medium | Explicitly out of scope — document as future work |

## Recommended Next Steps

1. **Create change proposal** for `release-install-polish` with the Tier 1 + Tier 2 items above
2. **Scope to ~5-7 tasks** — each independently testable
3. **No schema changes, no new dependencies, no architecture changes** — all modifications are additive to existing flows
4. **Test strategy**: Manual testing on Linux + macOS (if available), CI smoke test validates binary startup

## Ready for Proposal

**Yes.** The investigation is complete with:
- Full mapping of current install/upgrade flows (binary + repo paths)
- Identification of 6+ user friction points with severity ratings
- Clear distinction between what exists (doctor, status, preflight) and what's missing
- Tiered value analysis (high/medium/low impact vs effort)
- Safe scope boundaries that avoid architectural redesign
- No implementation blockers found
