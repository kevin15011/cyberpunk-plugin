# Exploration: install-presets

## Executive Summary

The cyberpunk CLI currently has **6 first-class components** (`plugin`, `theme`, `sounds`, `context-mode`, `rtk`, `tmux`) and requires users to either select them individually in the TUI multiselect or remember the right combination of `--flag` arguments. Presets solve this friction by packaging component selections into named profiles (`minimal`, `full`, `wsl`, `mac`) that map to common user scenarios and environment constraints.

The investigation reveals that presets can be implemented as a **thin mapping layer** on top of the existing install pipeline — no changes to `ComponentModule`, no new install logic, no schema migration. The safe first slice covers **2 presets (`minimal`, `full`)** plus the CLI/TUI integration points.

## Current State

### How the system works today

1. **Component model** (`src/components/types.ts`):
   - Each component implements `ComponentModule` with `install()`, `uninstall()`, `status()`, optional `doctor()`
   - 6 components registered in 6 locations: schema, install factory, status list, doctor factory, parse-args, output labels

2. **Install flow** (`src/commands/install.ts`):
   - `runInstall(componentIds, action)` iterates over component IDs sequentially
   - If no IDs provided, defaults to ALL components (`[...COMPONENT_IDS]`)
   - Each component handles its own idempotency (skips if already installed)
   - Partial failures are tolerated — results array contains per-component status

3. **TUI flow** (`src/tui/index.ts`):
   - `@clack/prompts` multiselect shows all 6 components with current status
   - User must manually toggle each component they want
   - No concept of "profiles" or "presets" — every component is independent

4. **CLI flag flow** (`src/cli/parse-args.ts`):
   - `--all` installs all 6 components
   - Individual flags: `--plugin`, `--theme`, `--sounds`, `--context-mode`, `--rtk`, `--tmux`
   - No preset flags exist

5. **Config schema** (`src/config/schema.ts`):
   - `CyberpunkConfig` tracks per-component install state
   - No preset-related fields exist
   - `installMode` tracks `"repo" | "binary"` install method

6. **Install script** (`install.sh`):
   - Downloads binary → `config init` → `config installMode binary` → launches TUI
   - User lands in TUI and must manually select components
   - **This is the primary friction point** — first-time users see 6 checkboxes with no guidance

### Current UX friction points

| Friction Point | Description | Severity |
|---|---|---|
| **TUI decision paralysis** | New users see 6 components with no guidance on which to pick | **High** |
| **No "just make it work" path** | `--all` installs everything including tmux (which may not be desired on a dev-only machine) | **High** |
| **Platform-specific deps** | `sounds` needs ffmpeg, `context-mode` needs npm, `rtk` needs curl — users don't know what's required | **Medium** |
| **WSL has different needs** | WSL users typically want tmux + plugin + theme + sounds but may not need context-mode (already have it on Windows host) | **Medium** |
| **macOS has different paths** | macOS users need `afplay` (built-in) vs Linux `ffplay`, and `brew install ffmpeg` vs `apt install ffmpeg` | **Medium** |
| **`--all` is too aggressive** | Installs tmux config which modifies `~/.tmux.conf` — users with existing tmux setups may not want this | **Medium** |

### Component dependency/prerequisite matrix

| Component | Requires | Platform Notes |
|---|---|---|
| `plugin` | OpenCode installed | Universal |
| `theme` | OpenCode installed | Universal |
| `sounds` | `ffmpeg` on PATH | Linux: `apt install ffmpeg`, macOS: `brew install ffmpeg` |
| `context-mode` | `npm` on PATH | Universal (Node.js ecosystem) |
| `rtk` | `curl` on PATH | Universal (downloads via curl) |
| `tmux` | `tmux` binary on PATH | Usually pre-installed on Linux, `brew install tmux` on macOS |

## Preset Design

### Proposed preset definitions

#### `minimal` — Core OpenCode experience
```
Components: plugin, theme
Prerequisites: OpenCode installed
Use case: "I just want the cyberpunk look and sound in OpenCode"
```
- **Why these components**: Plugin brings the runtime (sound events, SDD patching), theme brings the visual identity
- **Excludes**: sounds (needs ffmpeg), context-mode (needs npm), rtk (optional optimization), tmux (separate tool)
- **Platform**: Universal — works on Linux, macOS, WSL with zero extra deps

#### `full` — Complete cyberpunk environment
```
Components: plugin, theme, sounds, context-mode, rtk, tmux
Prerequisites: OpenCode, ffmpeg, npm, curl, tmux
Use case: "Give me everything, I'll install the deps"
```
- **Why all components**: This is the current `--all` behavior
- **Platform**: Universal but requires all dependencies
- **Note**: Individual components already handle missing deps gracefully (return `error` status)

#### `wsl` — WSL-optimized setup (deferred to slice 2)
```
Components: plugin, theme, sounds, tmux
Prerequisites: OpenCode, ffmpeg, tmux
Use case: "I'm in WSL, I want tmux + OpenCode cyberpunk"
```
- **Why exclude context-mode**: WSL users typically run OpenCode on the Windows host, not inside WSL
- **Why exclude rtk**: Same reasoning — token optimization is handled on the host
- **Platform**: Linux (WSL is detected via `/proc/version` containing "microsoft")

#### `mac` — macOS-optimized setup (deferred to slice 2)
```
Components: plugin, theme, sounds, context-mode, rtk
Prerequisites: OpenCode, ffmpeg (brew), npm
Use case: "I'm on macOS, give me the OpenCode experience"
```
- **Why exclude tmux**: macOS users often use iTerm2 splits or don't use tmux
- **Platform**: darwin only
- **Note**: Could include tmux as an optional add-on

### Preset resolution strategy

```
User runs: cyberpunk install --preset minimal
  → resolvePreset("minimal", currentPlatform) → ["plugin", "theme"]
  → runInstall(["plugin", "theme"])

User runs: cyberpunk install --preset full
  → resolvePreset("full", currentPlatform) → ["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"]
  → runInstall([...])

User runs: cyberpunk install --preset wsl (on non-WSL)
  → Warning: "wsl preset is intended for WSL environments. Continue?" [y/N]
  → If yes → proceed with wsl component list
```

### TUI integration

The TUI should offer presets as a **first step** before the component multiselect:

```
┌─ cyberpunk environment ─────────────────────────┐
│                                                  │
│  ¿Qué querés hacer?                              │
│                                                  │
│  ○ 📦 Instalar desde preset (recomendado)        │
│  ○ 🔧 Instalar componentes individuales          │
│  ○ 🗑️  Desinstalar componentes                   │
│  ○ 📊 Ver estado                                 │
│  ○ ❌ Salir                                     │
│                                                  │
└──────────────────────────────────────────────────┘
```

If user picks "Instalar desde preset":
```
┌─ Seleccioná un preset ──────────────────────────┐
│                                                  │
│  ○ minimal    — Plugin + Theme (sin deps extra)  │
│  ○ full       — Todo (plugin, theme, sounds,     │
│                   context-mode, rtk, tmux)        │
│  ○ wsl        — WSL optimizado (plugin, theme,   │
│                   sounds, tmux)                   │
│  ○ mac        — macOS optimizado (plugin, theme,  │
│                   sounds, context-mode, rtk)      │
│                                                  │
└──────────────────────────────────────────────────┘
```

After preset selection, show a confirmation with the component list:
```
┌─ Preset: minimal ───────────────────────────────┐
│                                                  │
│  Se instalarán los siguientes componentes:       │
│    ✓ Plugin de OpenCode                          │
│    ✓ Tema cyberpunk                              │
│                                                  │
│  ¿Continuar? [y/N]                               │
│                                                  │
└──────────────────────────────────────────────────┘
```

## Architectural Impact

### Where presets fit

Presets are a **resolution layer** — they map a preset name + platform to a `ComponentId[]` array, then delegate to the existing `runInstall()` pipeline.

| Layer | File | Change |
|---|---|---|
| **Preset definitions** | `src/presets/definitions.ts` (NEW) | Preset → ComponentId[] mapping + platform guards |
| **Preset resolver** | `src/presets/resolve.ts` (NEW) | `resolvePreset(name, platform) → ComponentId[]` |
| **CLI parser** | `src/cli/parse-args.ts` | Add `--preset <name>` flag |
| **Install command** | `src/commands/install.ts` | Accept preset name, resolve to component IDs |
| **TUI** | `src/tui/index.ts` | Add preset selection menu before component multiselect |
| **Output** | `src/cli/output.ts` | Add preset name to install results header |
| **Help text** | `src/cli/output.ts` | Add preset examples to `formatHelp()` |

### What does NOT change

- `ComponentModule` interface — no changes
- Individual component install/uninstall logic — no changes
- `CyberpunkConfig` schema — no new fields needed (presets are install-time only)
- Doctor command — no changes
- Status command — no changes
- Upgrade command — no changes

### Data model (new types only)

```typescript
type PresetId = "minimal" | "full" | "wsl" | "mac"

interface PresetDefinition {
  id: PresetId
  label: string
  description: string
  components: ComponentId[]
  platform?: "linux" | "darwin" | "wsl"  // optional platform constraint
  prerequisites?: string[]               // human-readable dep list for display
}
```

### Preset registry

```typescript
const PRESETS: PresetDefinition[] = [
  {
    id: "minimal",
    label: "Mínimo",
    description: "Plugin + Theme (sin dependencias extra)",
    components: ["plugin", "theme"],
    prerequisites: ["OpenCode"],
  },
  {
    id: "full",
    label: "Completo",
    description: "Todos los componentes",
    components: ["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"],
    prerequisites: ["OpenCode", "ffmpeg", "npm", "curl", "tmux"],
  },
  // wsl and mac deferred to slice 2
]
```

## Cross-Platform Considerations

### WSL detection

WSL can be detected at runtime:
```typescript
function isWSL(): boolean {
  try {
    const release = readFileSync("/proc/version", "utf8")
    return release.toLowerCase().includes("microsoft")
  } catch {
    return false
  }
}
```

This is already a pattern used in the codebase for platform detection (`process.platform === "darwin"`).

### Platform-aware preset filtering

The `resolvePreset()` function should:
1. If preset has a `platform` constraint and current platform doesn't match → warn and ask for confirmation
2. If preset components include platform-incompatible items → filter them out with a warning
3. Return the resolved component list

### Sound player differences

Already handled in the plugin runtime:
- macOS: `afplay` (built-in)
- Linux: `ffplay` (needs ffmpeg)
- The `sounds` component already checks for `ffmpeg` availability

### Tmux on macOS

The tmux config uses `pane-border-lines heavy` which requires tmux 3.2+. Most modern macOS installs via Homebrew have this. The tmux doctor already checks for binary availability.

## Safe Scope Boundaries

### IN scope (slice 1):
| Capability | Details |
|---|---|
| **Preset definitions** | `minimal` and `full` presets only |
| **CLI flag** | `cyberpunk install --preset minimal` |
| **Preset resolver** | Simple name → ComponentId[] mapping |
| **TUI preset menu** | Preset selection as first menu option |
| **Help text update** | Document `--preset` flag |
| **Output header** | Show which preset was used in install results |

### OUT of scope (deferred to slice 2):
| Capability | Reason |
|---|---|
| **`wsl` preset** | Requires WSL detection logic + validation |
| **`mac` preset** | Requires platform detection + validation |
| **Custom presets** | User-defined preset creation is a larger feature |
| **Perset persistence** | Storing "which preset was used" in config is unnecessary for v1 |
| **Preset diffing** | "What changed since I installed this preset" is a later feature |
| **Preset upgrade** | "Upgrade my preset to include new components" is a later feature |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Preset becomes stale** | Low | Presets are code, not config — they evolve with the codebase |
| **User installs preset, then adds components manually** | Low | This is expected behavior — presets are install-time only |
| **`full` preset fails on missing deps** | Medium | Individual components already return `error` status; user sees which failed |
| **WSL detection is unreliable** | Low (slice 2) | `/proc/version` check is well-established; can fall back to `uname -v` |
| **TUI becomes too many steps** | Low | Preset selection replaces, not adds to, the existing flow |
| **Preset name conflicts with future features** | Low | `PresetId` is a closed union type — easy to extend |

## Implementation Approach

### Phase 1: Core preset infrastructure
1. Create `src/presets/definitions.ts` with `minimal` and `full` presets
2. Create `src/presets/resolve.ts` with `resolvePreset()` function
3. Add `--preset` flag to `parse-args.ts`
4. Wire preset resolution into `runInstall()` in `install.ts`

### Phase 2: TUI integration
5. Add preset selection menu to TUI
6. Add confirmation screen showing resolved components
7. Update `formatHelp()` with preset examples

### Phase 3: Polish (optional)
8. Add platform detection for WSL/mac presets
9. Add prerequisite checking before preset install
10. Add `cyberpunk presets` command to list available presets

## CLI Interface (proposed)

```
cyberpunk install --preset minimal     # Install plugin + theme
cyberpunk install --preset full        # Install all 6 components
cyberpunk install --preset wsl         # Install WSL-optimized set (slice 2)
cyberpunk install --preset mac         # Install macOS-optimized set (slice 2)
cyberpunk presets                      # List available presets (slice 2)
```

### Backward compatibility

- `cyberpunk install --all` continues to work (installs all 6 components)
- `cyberpunk install --plugin --theme` continues to work
- `cyberpunk install` (no args, TUI) continues to work
- `--preset` and individual `--component` flags are mutually exclusive (error if both provided)

## Ready for Proposal

**Yes.** The investigation is complete with:
- Clear understanding of the current 6-component architecture
- Identified UX friction points (TUI decision paralysis, no guided path)
- Defined 4 preset shapes (`minimal`, `full`, `wsl`, `mac`) with rationale
- Safe scope boundaries for slice 1 (`minimal` + `full` only)
- Minimal architectural impact (thin resolution layer, no schema changes)
- No implementation blockers found
