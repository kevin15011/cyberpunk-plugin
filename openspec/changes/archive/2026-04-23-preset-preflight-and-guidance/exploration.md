# Exploration: preset-preflight-and-guidance

## Executive Summary

The current preset install flow shows a **minimal summary** (preset name, component list, static warnings) before execution but lacks **live environment awareness** — it does not check which dependencies are actually present on the user's machine, which files will be touched, or which components are likely to fail. The doctor command already has all this knowledge (`checkPlatformPrerequisites`, per-component `doctor()` methods), but install and doctor are completely disconnected. This change bridges that gap by adding a lightweight preflight layer that reuses doctor/prerequisite knowledge without running a full doctor scan.

## Current State

### How preset install works today

1. **CLI path** (`src/index.ts` → `src/commands/install.ts`):
   - `cyberpunk install --preset full` → `resolvePreset("full")` → `runInstall([...])`
   - `formatPresetSummary(resolved)` prints preset name, component list, and **static warnings** from `PRESET_DEFINITIONS`
   - No environment checks happen before `runInstall()` executes
   - Components fail silently during install if deps are missing (e.g., sounds → "ffmpeg no encontrado")

2. **TUI path** (`src/tui/index.ts` → `handleInstall`):
   - User selects preset from `PRESET_NAMES` list
   - `clack.note(formatPresetSummary(resolved))` shows same static summary
   - `clack.confirm()` asks "¿Instalar preset X con N componentes?"
   - Spinner runs `runInstall()` — failures appear only after execution

3. **Static warnings** (`src/presets/definitions.ts`):
   ```typescript
   FULL_WARNINGS = [
     "sounds necesita ffmpeg instalado",
     "context-mode necesita npm instalado",
     "rtk necesita curl instalado",
     "tmux solo modifica el bloque gestionado en ~/.tmux.conf",
   ]
   ```
   These are **hardcoded strings** — they don't check if ffmpeg/npm/curl are actually present.

### What doctor already knows

The `doctor` command (`src/commands/doctor.ts`) runs `checkPlatformPrerequisites()` which detects:
- `ffmpeg` — required by `sounds`
- `npm`/`bun` — required by `context-mode`
- `curl` — required by `rtk`

Each component's `doctor()` method also checks file existence, registration status, etc. This is **exactly the information** a preflight should show, but doctor is a separate command with a different UX (full diagnostic report with fix capability).

### Current UX gap — what's missing before install

| Missing Information | Impact |
|---|---|
| **Live dependency status** — Are ffmpeg/npm/curl actually on PATH? | User sees "sounds necesita ffmpeg" warning but doesn't know if they already have it |
| **Per-component readiness** — Which components will succeed vs fail? | `full` preset on a machine without ffmpeg will fail sounds silently during install |
| **Files that will be touched** — What paths will be created/modified? | No disclosure of `~/.config/opencode/plugins/cyberpunk.ts`, `~/.tmux.conf`, etc. |
| **Already-installed components** — What's already there? | `runInstall()` handles idempotency but user doesn't know beforehand |
| **Platform mismatch context** — Why is wsl preset warned on Linux? | Current mismatch warning is generic, doesn't explain implications |

### What's already partially addressed

- **Static warnings** exist in preset definitions (ffmpeg, npm, curl mentions)
- **Platform mismatch** detection exists in `resolvePreset()` (wsl/mac vs detected env)
- **Tmux managed-block** warning is included in preset warnings
- **Component list** is shown before install via `formatPresetSummary()`

## Affected Areas

| File | Why Affected |
|---|---|
| `src/presets/definitions.ts` | May need `prerequisites` field per preset (which deps each preset needs) |
| `src/presets/resolve.ts` | Resolution should include live prerequisite checks, not just static warnings |
| `src/commands/install.ts` | Entry point for preflight — needs to run checks before `runInstall()` |
| `src/cli/output.ts` | `formatPresetSummary()` needs enhancement to show preflight data |
| `src/tui/index.ts` | `handleInstall()` needs preflight step between resolve and confirm |
| `src/components/platform.ts` | `checkPlatformPrerequisites()` is the reusable function to call |
| `src/index.ts` | CLI install dispatch needs preflight call before `runInstall()` |

## Approaches

### Approach 1: Lightweight preflight function (Recommended)

Create a new `runPreflight(preset: ResolvedPreset)` function that:
1. Calls `checkPlatformPrerequisites()` (already exists)
2. Maps prerequisites to preset components (sounds→ffmpeg, context-mode→npm, rtk→curl)
3. Returns a `PreflightSummary` with: missing deps, present deps, files-to-touch list, already-installed components
4. Is called from both CLI (`index.ts`) and TUI (`tui/index.ts`) before `runInstall()`

**Pros:**
- Reuses existing `checkPlatformPrerequisites()` — zero new detection logic
- Fast (3 `which` calls) — adds <100ms to install flow
- Works for both CLI and TUI paths
- Does NOT run full doctor — only checks what's relevant to the preset's components
- Clear separation: preflight = read-only info gathering, install = execution

**Cons:**
- Need to maintain mapping between components and their prerequisites
- Doesn't check file-level readiness (plugin file exists, theme files, etc.) — only platform deps

**Effort:** Low

### Approach 2: Subset of doctor command

Extract doctor's check logic into a reusable `runChecks(componentIds)` that can be called by both doctor and install.

**Pros:**
- Maximum information — gets full doctor-level detail
- Single source of truth for all checks

**Cons:**
- Doctor does much more than preflight needs (config shape, registration status, patching drift, etc.)
- Doctor has fix logic intertwined — extracting checks without fixes is complex
- Slower — doctor runs many filesystem reads per component
- Overkill for preflight — user just needs "will this work?" not "is everything healthy?"

**Effort:** Medium-High

### Approach 3: Enhance preset definitions with prerequisite metadata

Add `prerequisites: string[]` to each preset definition, then check them at resolve time.

**Pros:**
- Self-documenting — preset declares its own needs
- Simple to implement

**Cons:**
- Still static — doesn't check what's actually on the machine
- Duplicates knowledge already in `platform.ts` and component modules
- Doesn't solve the "already installed" or "files touched" gaps

**Effort:** Low (but incomplete solution)

### Approach 4: Pre-install status check

Call `collectStatus()` (already used by TUI) before install to show which components are already installed.

**Pros:**
- Reuses existing `collectStatus()` function
- Shows current state accurately

**Cons:**
- `collectStatus()` is relatively slow (checks each component's files)
- Doesn't cover prerequisite detection (ffmpeg, npm, curl)
- Would need to be combined with Approach 1 for full coverage

**Effort:** Low-Medium

## Recommendation

**Combine Approach 1 + Approach 4** as a single preflight layer:

1. **New module**: `src/commands/preflight.ts` — exports `runPreflight(componentIds)` that:
   - Calls `checkPlatformPrerequisites()` for live dep detection
   - Calls `collectStatus()` for already-installed detection (reuse existing)
   - Returns structured `PreflightResult` with:
     - `missingDeps`: `{ component: ComponentId, dep: string, installHint: string }[]`
     - `presentDeps`: same shape for deps that ARE available
     - `alreadyInstalled`: `ComponentId[]` — components that will skip
     - `filesToTouch`: `{ path: string, action: "create" | "modify" }[]` — disclosure of paths
     - `warnings`: `string[]` — platform mismatch, tmux managed-block, etc.

2. **Enhance output**: Update `formatPresetSummary()` → `formatPreflightSummary()` to display the preflight data in a clean format.

3. **Wire into flows**:
   - CLI: `index.ts` calls `runPreflight()` → prints summary → asks for confirmation → runs install
   - TUI: `handleInstall()` calls `runPreflight()` → shows `clack.note()` → confirms → runs install

### Why this scope is right

- **Reuses existing knowledge**: `checkPlatformPrerequisites()` and `collectStatus()` already exist
- **Does NOT become doctor**: Preflight is read-only, fast, and scoped to the preset's components only
- **No schema changes**: `CyberpunkConfig` doesn't need new fields
- **No new detection logic**: All checks delegate to existing functions
- **Clear boundary**: Preflight = information disclosure, Install = execution

## Scope Boundaries

### IN scope
| Capability | Details |
|---|---|
| **Live prerequisite checks** | Check ffmpeg/npm/curl availability before install |
| **Already-installed detection** | Show which components will skip (idempotent) |
| **Files-to-touch disclosure** | List paths that will be created/modified |
| **Enhanced preset summary** | Show preflight data in CLI and TUI |
| **Confirmation before install** | User sees preflight, confirms, then install runs |
| **Component→dep mapping** | Internal mapping (sounds→ffmpeg, context-mode→npm, rtk→curl) |

### OUT of scope (explicitly deferred)
| Capability | Reason |
|---|---|
| **Full doctor integration** | Doctor checks config shape, registration, patching drift — too heavy for preflight |
| **Auto-fix missing deps** | Bootstrap/install deps is beyond scope — preflight is read-only |
| **Preset persistence** | Remembering which preset was used is a separate feature |
| **Custom user presets** | User-defined presets are a larger feature |
| **Interactive dep install** | "Want me to install ffmpeg for you?" — too complex, platform-specific |
| **Pre-install backup warnings** | Backup logic is per-component, already handled during install |
| **`cyberpunk preflight` standalone command** | Could be added later, but preflight is primarily an install-time concern |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Preflight slows down install** | Low | Only 3 `which` calls + `collectStatus()` — should be <500ms total |
| **Component→dep mapping drifts** | Low | Mapping is in one place (`preflight.ts`), easy to update when new components/deps are added |
| **TUI note becomes too long** | Medium | Format preflight output concisely; use sections; prioritize critical info |
| **User ignores warnings and proceeds** | Low (acceptable) | Current behavior already allows proceeding with warnings; preflight just makes it informed |
| **`collectStatus()` has side effects** | Low | `collectStatus()` is read-only — only checks file existence |
| **Files-to-touch list is incomplete** | Medium | Each component knows its own paths; preflight can only list known paths. Document this limitation. |

## Ready for Proposal

**Yes.** The investigation is complete with:
- Full understanding of current preset install flow (CLI + TUI)
- Identification of all missing preflight information
- Clear mapping of reusable doctor/platform knowledge
- Recommended approach (lightweight preflight function reusing existing checks)
- Defined scope boundaries (IN/OUT)
- No implementation blockers found
