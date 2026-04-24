# Exploration: doctor-expansion

## Current State

The doctor command (`cyberpunk doctor [--fix] [--json] [--verbose] [components...]`) was established across two prior slices (`toolkit-doctor-repair` and `tmux-tpm-bootstrap`). It covers:

| Domain | Checks | Fixable? |
|--------|--------|----------|
| **platform** | ffmpeg, npm/bun, curl, git on PATH | No (advisory) |
| **config** | File exists, valid JSON, required fields (`version`, `components`) | Yes (write defaults / merge) |
| **plugin** | File exists, registered in opencode.json, Section E/F patching in sdd-phase-common.md | Yes (patch + register) |
| **theme** | Theme JSON exists, tui.json has `theme: "cyberpunk"` | Yes (write + activate) |
| **sounds** | ffmpeg available, all 4 .wav files exist | Yes (regenerate via ffmpeg) |
| **context-mode** | npm available, binary on PATH, routing file exists, MCP in opencode.json | Yes (routing + MCP) |
| **rtk** | Binary on PATH, routing file exists, plugin registered in opencode.json | Yes (routing + register) |
| **tmux** | Binary on PATH, managed config block present, TPM installed, plugins installed, gitmux on PATH | Yes (config block + TPM clone + plugin install) |

Total: **~22 checks** across 8 domains. All components have `doctor()` implementations.

### Architecture

- `src/commands/doctor.ts` — orchestrator: collects checks, runs fixes in priority order, computes summary
- `src/components/*.ts` — each component exposes `doctor(ctx): Promise<DoctorResult>`
- `src/components/config-doctor.ts` — config integrity checks (not a component module)
- `src/components/theme-doctor.ts` — theme checks + repair (separated from theme.ts)
- `src/components/platform.ts` — prerequisite detection (ffmpeg, npm, bun, curl, git)
- `src/cli/output.ts` — `formatDoctorText()` and `formatDoctorJson()`
- `src/platform/detect.ts` — lightweight platform detection (linux/wsl/darwin) — **not currently used by doctor**

### Test Coverage

- `tests/doctor.test.ts` — parse-args flags, summary derivation, tmux fix orchestration, HOME isolation
- `tests/doctor-scenarios.test.ts` — 14 spec-mapped scenarios covering all doctor spec requirements
- Tests use `runDoctorIsolated()` subprocess pattern for HOME/PATH isolation

## Blind Spots and Missing High-Value Checks

### 1. Platform Detection Not Leveraged (BLIND SPOT)

`src/platform/detect.ts` exists with `isWSL()` / `detectEnvironment()` but **doctor never calls it**. This means:
- WSL-specific guidance (e.g., `paplay` vs `afplay`, `/proc/version` checks) is not surfaced
- macOS-specific checks (Homebrew vs apt, `afplay` availability) are not surfaced
- No platform-aware warnings in doctor output

**Impact**: User gets generic "ffmpeg not found" without platform-specific install instructions.

### 2. Sound Playback Path Not Verified

The plugin uses `paplay` on Linux/WSL and `afplay` on macOS, but doctor only checks for `ffmpeg` (generation). The **playback binary** is never checked:
- Linux/WSL: `paplay` (from `pulseaudio-utils` or `pipewire`) may be missing even if ffmpeg exists
- macOS: `afplay` is always present, but this is not verified
- No check for actual sound file validity (corrupted .wav files pass the existence check)

**Impact**: Sounds silently fail at runtime even when doctor reports "all pass."

### 3. OpenCode Binary / Runtime Not Checked

Doctor verifies `opencode.json` exists and is parseable, but never checks:
- Whether `opencode` binary is on PATH
- Whether OpenCode version is compatible with the plugin
- Whether the skills directory structure (`~/.config/opencode/skills/_shared/`) is valid

**Impact**: Plugin installed but OpenCode not present → doctor says "pass" but nothing works.

### 4. Plugin Source Drift Not Detected

Doctor checks if the plugin file *exists*, but does **not** verify if its content matches the bundled `PLUGIN_SOURCE`. If the user manually edited the installed plugin, doctor would still report "pass."

**Impact**: Modified plugin could have broken event handlers or missing patching logic.

### 5. Config Version Migration Not Handled

`CyberpunkConfig.version` is checked for existence but not validated. If a future version changes the schema, doctor would pass on v1 configs that are now incomplete.

**Impact**: Schema drift goes undetected.

### 6. No Check for Conflicting Themes or Routing Files

- If a user has multiple theme files, doctor only checks `cyberpunk.json` exists
- If routing files exist but were created by another tool (not cyberpunk-managed), doctor reports "warn" but doesn't identify the conflict source
- No check for stale `.bak` files accumulating

### 7. Tmux: No Active Session Health Check

Doctor checks config file state but never verifies:
- Whether tmux is actually running
- Whether the managed config has been sourced into active sessions
- Whether `tmux source-file` would succeed (syntax validation)

**Impact**: Config is correct but tmux sessions still use old config until manually reloaded.

### 8. No Binary Install Mode Checks

The schema supports `installMode: "repo" | "binary"`, but doctor never checks:
- Whether the compiled binary exists at the expected path (binary mode)
- Whether the repo clone is intact (repo mode)
- Whether `cyberpunk` itself is up-to-date (self-check)

### 9. No Dependency Chain Validation

Components have implicit dependencies (sounds → ffmpeg, context-mode → npm, rtk → curl) but doctor doesn't validate the **chain**:
- If ffmpeg is missing, sounds will fail — but doctor reports sounds:files as "fail" rather than "skipped (ffmpeg missing)"
- No aggregate view of "install X to unlock Y"

### 10. Output UX Gaps

Current output is a flat table. Missing:
- Grouping by component (headers between sections)
- Actionable next-steps section ("Run `cyberpunk doctor --fix` to repair 3 issues")
- Platform-specific install commands in messages (e.g., "Install with: `sudo apt install ffmpeg`" vs `brew install ffmpeg`)
- Color-coded severity summary at the top (not just at the bottom)
- `--component` flag not documented in help for doctor scoping

## WSL/mac/Linux Behavior Influence

| Behavior | Linux | WSL | macOS | Doctor Impact |
|----------|-------|-----|-------|---------------|
| Sound playback | `paplay` | `paplay` | `afplay` | Need playback binary check |
| ffmpeg install | `apt install ffmpeg` | `apt install ffmpeg` | `brew install ffmpeg` | Platform-aware messages |
| tmux | native | native (may need DISPLAY) | native (may need reattach-to-user-namespace) | Session check differs |
| Home dir | `$HOME` | `$HOME` (may be `/home/user`) | `$HOME` | Already handled |
| PATH for rtk | `~/.local/bin` | `~/.local/bin` | `~/.local/bin` | Already handled |
| Config base | `~/.config` | `~/.config` | `~/.config` | Already handled |
| TPM git clone | native | native (may need git config) | native (Xcode tools) | Already handled |

## Scope Boundaries for This Slice

### Recommended In Scope

1. **Platform-aware doctor messages** — Use `detectEnvironment()` to tailor install guidance per platform
2. **Sound playback binary check** — Add `platform:paplay` / `platform:afplay` check
3. **OpenCode binary check** — Add `platform:opencode` check
4. **Plugin source drift detection** — Add `plugin:source-match` check comparing installed vs bundled source
5. **Output grouping by component** — Add section headers in `formatDoctorText()`
6. **Actionable summary** — Add "Next steps" section to doctor output
7. **Sound file validity check** — Basic header validation for .wav files (not just existence)

### Recommended Out of Scope

- Active tmux session health / reload (complex, platform-specific)
- Binary install mode verification (needs build-time path injection)
- Config version migration logic (schema change, bigger scope)
- Full dependency chain visualization (UI complexity)
- Self-update check (belongs in `upgrade` command)
- Conflicting file detection (edge case, low frequency)

## Approaches

### 1. Incremental Check Additions + Output Polish

Add new checks to existing component modules and platform checks, enhance output formatting. Reuse the `DoctorCheck` model and `--fix` pattern already established.

**Pros**: Minimal architectural change, consistent with existing patterns, finishable in one session
**Cons**: Each check is a small addition; could feel piecemeal
**Effort**: Medium

### 2. Diagnostic Rules Engine

Replace individual check functions with a rules-based system that evaluates conditions and produces checks dynamically based on platform, installed components, and dependency chains.

**Pros**: More flexible, handles dependency chains natively, easier to add new rules
**Cons**: Significant refactor, over-engineering for current needs
**Effort**: High

### 3. Component-Level Diagnostic Expansion Only

Only expand checks within existing component modules without changing output format or adding platform awareness.

**Pros**: Safest, most focused
**Cons**: Misses UX improvements, platform guidance remains generic
**Effort**: Low

### Recommendation: Option 1

Incremental additions with output polish. The existing architecture is sound; the gaps are specific missing checks and formatting improvements. This approach delivers the most user-visible value with the least risk.

## Risks

1. **Plugin source comparison could be slow** — Comparing full `PLUGIN_SOURCE` strings is O(n) but the string is ~3KB; negligible impact
2. **Platform detection on edge cases** — WSL2 detection via `/proc/version` may fail in containers; should gracefully default to "linux"
3. **Wav file validation false positives** — Basic header checks might reject valid but unusual .wav files; keep validation minimal (RIFF header + WAVE fmt)
4. **Output formatting changes** — Adding section headers could break any downstream parsing of doctor output; the `--json` format is the stable contract
5. **Scope creep** — Easy to keep adding checks; must enforce the boundary list strictly

## Ready for Proposal

**Yes** — the gaps are well-defined, the existing architecture supports incremental additions, and the scope boundaries keep this slice finishable. Recommended next: `sdd-propose` to formalize intent and approach.
