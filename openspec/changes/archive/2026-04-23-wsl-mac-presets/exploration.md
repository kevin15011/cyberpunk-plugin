# Exploration: wsl-mac-presets

## Executive Summary

The `wsl` and `mac` presets were explicitly deferred from `install-presets` slice 1. This exploration investigates how they should be built on top of the existing preset registry, what environment-specific friction each platform introduces, and what the safe first-slice scope should be.

**Key finding**: The existing preset architecture (`PresetId` union, `PRESET_DEFINITIONS` Map, `resolvePreset()`, `DEFERRED_PRESETS` guard) was designed with `wsl`/`mac` in mind. Adding them requires **zero architectural changes** — only definition entries, platform detection, and environment-specific warnings. The recommended first slice delivers both presets with platform-aware resolution and graceful degradation.

## Current State

### Preset Registry Architecture

The preset system (`src/presets/`) consists of three files:

| File | Role |
|------|------|
| `definitions.ts` | `PresetId` union type, `PresetDefinition` interface, `PRESET_DEFINITIONS` Map |
| `resolve.ts` | `resolvePreset(name)` validates and returns `ResolvedPreset`; has `DEFERRED_PRESETS = new Set(["wsl", "mac"])` |
| `index.ts` | Barrel re-exports |

The `DEFERRED_PRESETS` guard in `resolve.ts` (line 5) already throws a specific error for `wsl`/`mac` names. This is the **only** code-level reference to these presets.

### TUI Preset Selection

In `src/tui/index.ts`, `handleInstall()` builds preset choices from `PRESET_NAMES` (line 93-96), which is derived from `PRESET_DEFINITIONS`. Deferred presets are **automatically excluded** from the TUI menu because they're not in the Map.

### CLI Preset Selection

In `src/index.ts` (line 46-55), `--preset` is passed directly to `resolvePreset()`. If a deferred preset name is used, the error from `DEFERRED_PRESETS` is caught and displayed.

### Platform Detection Patterns Already in Use

| Location | Detection | Purpose |
|----------|-----------|---------|
| `src/components/plugin.ts` (line 116) | `process.platform === "darwin"` | Sound playback: `afplay` vs `paplay` |
| `install.sh` (line 8) | `uname -s` | Binary download path selection |
| `install.sh` (line 19-22) | `/etc/os-release` grep for alpine/musl | Static binary detection |
| `src/components/platform.ts` | `which` checks for ffmpeg/npm/bun/curl | Prerequisite validation |

**No WSL detection exists yet.** The previous exploration identified `/proc/version` containing "microsoft" as the detection pattern.

### Environment-Specific Friction Per Component

| Component | WSL Friction | macOS Friction |
|-----------|-------------|----------------|
| **plugin** | None — OpenCode runs on Windows host, plugin file path works in WSL | None — same file paths |
| **theme** | None | None |
| **sounds** | `ffmpeg` install via `apt` (usually available in WSL distros). `paplay` may not work in WSL without PulseAudio | `ffmpeg` via `brew`. Plugin already uses `afplay` (built-in) for playback — **no ffmpeg needed for playback, only for generation** |
| **context-mode** | WSL users typically run OpenCode on Windows host, not inside WSL — context-mode may be redundant | `npm` via brew or nvm. Works normally |
| **rtk** | Same reasoning as context-mode — host-side tool | `curl` usually pre-installed. Works normally |
| **tmux** | **High value** — WSL users are heavy tmux users. TPM plugins may need `git` installed. `pane-border-lines heavy` requires tmux 3.2+ | tmux not pre-installed. `brew install tmux` needed. Same tmux 3.2+ requirement |

### Additional Platform-Specific Concerns

**WSL:**
- Sound playback via `paplay` requires PulseAudio server running on Windows side — often not configured
- `ffmpeg` for sound generation works fine in WSL (Linux binary)
- OpenCode config paths (`~/.config/opencode/`) work identically in WSL
- WSL users may have OpenCode installed on Windows host, not inside WSL — the plugin would need to be installed in the Windows-side OpenCode, not the WSL-side one

**macOS:**
- Sound playback via `afplay` is built-in — **zero friction for playback**
- Sound generation still needs `ffmpeg` (`brew install ffmpeg`)
- Gatekeeper warnings on unsigned binaries (separate `macos-support` change addresses this)
- Homebrew prefix may be `/opt/homebrew` (Apple Silicon) or `/usr/local` (Intel) — affects PATH for `which` checks
- `~/.tmux.conf` path works identically

## Affected Areas

| File | Change Type | Why |
|------|-------------|-----|
| `src/presets/definitions.ts` | Modify | Add `wsl` and `mac` to `PresetId` union, add entries to `PRESET_DEFINITIONS` |
| `src/presets/resolve.ts` | Modify | Remove `wsl`/`mac` from `DEFERRED_PRESETS`, add platform-aware resolution |
| `src/presets/index.ts` | No change | Barrel exports work automatically |
| `src/components/platform.ts` | Modify | Add `tmux` and `wsldetect` to prerequisites |
| `src/commands/doctor.ts` | Modify | Add WSL detection check to platform checks |
| `src/cli/output.ts` | Modify | Update help text with new preset names |
| `src/tui/index.ts` | No change | Automatically includes new presets from `PRESET_NAMES` |
| `openspec/specs/cyberpunk-install/spec.md` | Modify | Update spec to include wsl/mac scenarios |
| `openspec/specs/cyberpunk-tui/spec.md` | Modify | Update TUI spec for new preset availability |

## Approaches

### Approach A: Platform-Aware Presets with Auto-Detection (Recommended)

Add `wsl` and `mac` presets with platform constraints. `resolvePreset()` detects the current platform and:
- If platform matches → resolve normally
- If platform mismatches → warn but allow (user override)
- Auto-detect WSL via `/proc/version` containing "microsoft"

| Aspect | Details |
|--------|---------|
| **Pros** | Best UX — presets "just work" on the right platform; warnings on wrong platform; auto-detection is reliable |
| **Cons** | Requires new platform detection module; WSL detection has edge cases (WSL1 vs WSL2, custom kernels) |
| **Effort** | Medium — 3 new files/modules, ~150 lines of code |
| **New files** | `src/platform/detect.ts` (platform + WSL detection) |

**Preset definitions:**
```
wsl:    plugin, theme, sounds, tmux
        (excludes context-mode, rtk — host-side tools)
        warnings: "paplay puede no funcionar en WSL sin PulseAudio configurado"

mac:    plugin, theme, sounds, context-mode, rtk
        (excludes tmux — macOS users often don't use tmux)
        warnings: "ffmpeg requiere brew install ffmpeg", "tmux no incluido — instalá con brew install tmux si lo necesitás"
```

### Approach B: Platform-Agnostic Presets (User Chooses)

Add `wsl` and `mac` presets without platform detection. They're always available regardless of current platform. User is responsible for choosing the right one.

| Aspect | Details |
|--------|---------|
| **Pros** | Simplest implementation; no detection logic needed; user can install "mac preset" on Linux if they want |
| **Cons** | No guardrails — user might install wrong preset; less "intelligent" UX |
| **Effort** | Low — just definition entries, ~30 lines of code |

### Approach C: Platform-Aware with Component Filtering

Like Approach A, but additionally filters out incompatible components at resolution time (e.g., if `sounds` component's playback system isn't available on the detected platform, exclude it).

| Aspect | Details |
|--------|---------|
| **Pros** | Most robust — prevents install failures before they happen |
| **Cons** | Complex coupling between preset resolver and component prerequisites; changes the semantic of presets (dynamic component list) |
| **Effort** | High — requires prerequisite checking in resolution path |

## Recommendation

**Approach A** (Platform-Aware Presets with Auto-Detection) for the following reasons:

1. **The architecture already supports it** — `DEFERRED_PRESETS` was explicitly designed as a temporary gate
2. **WSL detection is reliable** — `/proc/version` containing "microsoft" is the industry-standard approach
3. **macOS detection is trivial** — `process.platform === "darwin"` is already used in the codebase
4. **Warnings > hard blocks** — The system should warn when a preset doesn't match the platform, but allow override (user might be setting up a remote machine)
5. **Minimal new code** — A single `detectPlatform()` function (~30 lines) plus preset definitions

### Recommended Preset Definitions

#### `wsl` — WSL-Optimized Setup
```
Components: plugin, theme, sounds, tmux
Excludes: context-mode, rtk
Rationale: WSL users typically run OpenCode on the Windows host
           context-mode and rtk are host-side optimizations
           tmux is high-value for WSL terminal workflows
Warnings:
  - "paplay puede no funcionar en WSL sin PulseAudio configurado"
  - "tmux solo modifica el bloque gestionado en ~/.tmux.conf"
Prerequisites: OpenCode, ffmpeg, tmux
```

#### `mac` — macOS-Optimized Setup
```
Components: plugin, theme, sounds, context-mode, rtk
Excludes: tmux
Rationale: macOS users often use iTerm2 splits or native tabs
           tmux is available but not the default workflow
           All other components work identically on macOS
Warnings:
  - "sounds necesita ffmpeg instalado (brew install ffmpeg)"
  - "context-mode necesita npm instalado"
  - "rtk necesita curl instalado"
  - "tmux no incluido — instalá con brew install tmux si lo necesitás"
Prerequisites: OpenCode, ffmpeg (brew), npm, curl
```

### Platform Detection Design

```typescript
// src/platform/detect.ts
export type PlatformId = "linux" | "darwin" | "wsl"

export function detectPlatform(): PlatformId {
  if (process.platform === "darwin") return "darwin"
  if (isWSL()) return "wsl"
  return "linux"
}

function isWSL(): boolean {
  try {
    const release = readFileSync("/proc/version", "utf8")
    return release.toLowerCase().includes("microsoft") ||
           release.toLowerCase().includes("wsl")
  } catch {
    return false
  }
}
```

### Resolution Flow

```
User: cyberpunk install --preset wsl
  → resolvePreset("wsl")
  → detectPlatform() → current platform
  → If current === "wsl" → resolve normally
  → If current !== "wsl" → add warning: "wsl preset está diseñado para WSL"
  → Return ResolvedPreset with warnings
```

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **WSL detection false positives** | Low | Check both "microsoft" AND "wsl" in `/proc/version`; fallback to `false` on read error |
| **WSL detection false negatives** | Low | WSL2 always has "microsoft" in `/proc/version`; WSL1 has "Microsoft" |
| **Sound playback fails on WSL** | Medium | Warning in preset; `sounds` component already handles missing `paplay` gracefully (returns error) |
| **macOS user wants tmux** | Low | `mac` preset excludes tmux by design; user can install it separately or via `full` preset |
| **User installs wrong preset on wrong platform** | Low | Warning shown; user can override; components handle missing deps individually |
| **`afplay` not found on macOS** | Very Low | `afplay` is a built-in macOS utility since OS X 10.0 — always present |
| **Homebrew PATH not in scope for `which`** | Medium | macOS users with non-standard brew installs may have `ffmpeg` installed but not on PATH; this is a pre-existing issue, not preset-specific |
| **Preset definitions drift from component reality** | Low | Presets are code, not config — they're reviewed in PRs alongside component changes |

## Safe Scope Boundaries

### IN scope (this slice):
| Capability | Details |
|---|---|
| **`wsl` preset definition** | plugin, theme, sounds, tmux + WSL-specific warnings |
| **`mac` preset definition** | plugin, theme, sounds, context-mode, rtk + macOS-specific warnings |
| **Platform detection** | `detectPlatform()` function with WSL + darwin detection |
| **Platform-aware resolution** | Warning on platform mismatch, not blocking |
| **Remove DEFERRED_PRESETS guard** | `wsl`/`mac` become first-class presets |
| **Help text update** | Document new presets in `formatHelp()` |
| **Spec updates** | Add scenarios for wsl/mac presets |

### OUT of scope (deferred):
| Capability | Reason |
|---|---|
| **Auto-install missing deps** | Too complex — each platform has different package managers |
| **Preset persistence** | Storing "which preset was used" is unnecessary |
| **Dynamic component filtering** | Changes preset semantics; adds complexity |
| **WSL-specific sound playback fix** | Requires PulseAudio setup guidance — separate concern |
| **macOS binary signing** | Already tracked in `macos-support` change |
| **`cyberpunk presets` command** | Nice-to-have, not required for functionality |

## Ready for Proposal

**Yes.** The investigation is complete with:
- Full understanding of the existing preset architecture and how wsl/mac fit in
- Clear platform detection strategy (WSL via `/proc/version`, macOS via `process.platform`)
- Defined preset compositions with rationale for each inclusion/exclusion
- Identified all environment-specific friction points per component
- Risk assessment with mitigations
- Safe scope boundaries for a first slice that delivers both presets
