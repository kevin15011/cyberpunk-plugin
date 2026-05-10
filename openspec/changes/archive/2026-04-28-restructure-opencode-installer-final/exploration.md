# Exploration: Restructure OpenCode Installer

## Current State

The cyberpunk-plugin is a Bun + TypeScript CLI that installs a cyberpunk dev environment for OpenCode + tmux. It has 10 components managed through a flat component registry:

| Component | What it does | Key files touched |
|-----------|-------------|-------------------|
| `plugin` | Installs `cyberpunk.ts` to `~/.config/opencode/plugins/`, registers in `opencode.json`, **AND patches `sdd-phase-common.md`** with context-mode/RTK routing | `~/.config/opencode/plugins/cyberpunk.ts`, `opencode.json`, `sdd-phase-common.md` |
| `theme` | Cyberpunk theme JSON for OpenCode | `~/.config/opencode/themes/cyberpunk.json` |
| `sounds` | Generates 4 .wav files via ffmpeg | `~/.config/opencode/sounds/*.wav` |
| `context-mode` | `npm install -g context-mode`, writes routing instructions, patches MCP in `opencode.json` | `context-mode-routing.md`, `opencode.json` |
| `rtk` | Downloads rtk CLI proxy, writes routing instructions, runs `rtk init -g --opencode` | `rtk-routing.md` |
| `tmux` | Manages `~/.tmux.conf` block, clones TPM, installs plugins | `~/.tmux.conf` |
| `tui-plugins` | Registers SDD Engram + Statusline plugins in `tui.json` | `~/.config/opencode/tui.json` |
| `codebase-memory` | Downloads `codebase-memory-mcp` binary, patches MCP config, writes routing | `codebase-memory-routing.md`, `opencode.json` |
| `otel` | Registers OTEL plugin, writes env vars to shell profiles | `~/.bashrc`/`~/.zshrc`, `opencode.json` |
| `otel-collector` | Installs otelcol-contrib, writes config, manages systemd service | `~/.config/cyberpunk/otel-collector/config.yaml` |

### Critical Problem: `plugin` component has dual responsibility

The `plugin` component currently does TWO conceptually different things:

1. **OpenCode Event/Sound Runtime Plugin** — installs `cyberpunk.ts` which plays sounds for OpenCode events (idle, error, compact, permission). This is the user-facing "cyberpunk experience."

2. **SDD Integration** — patches `~/.config/opencode/skills/_shared/sdd-phase-common.md` with Section E (ctx_stats) and Section F (RTK routing). This is SDD-specific and should be optional because not all users have SDD profiles/agents.

The bundled `PLUGIN_SOURCE` in `src/components/plugin.ts` (lines 126-265) contains BOTH the sound playback logic AND the `patchSddPhaseCommon()` function. The installed `cyberpunk.ts` also duplicates the patching logic (lines 137-216).

### Current presets (4 total)

- `minimal` — plugin + theme
- `full` — all 10 components
- `wsl` — plugin + theme + sounds + tmux
- `mac` — plugin + theme + sounds + context-mode + rtk

### Installer flow

1. `install.sh` downloads binary to `~/.local/bin/cyberpunk`, configures PATH, launches TUI
2. TUI home screen → Install → Preset picker or Manual selection → Confirm → Install
3. `runInstall()` iterates components, calls each component's `install()` method

### Known bugs discovered

1. **codebase-memory MCP path bug**: The MCP config in `codebase-memory.ts` uses `command: ["codebase-memory-mcp"]` (bare command name). If the binary is installed to `~/.local/bin` but that directory isn't in PATH for the OpenCode process, the MCP server fails with "Executable not found in $PATH". Fix: use absolute path `~/.local/bin/codebase-memory-mcp` or validate PATH at install time.

2. **Context-mode MCP path bug**: Same issue — `command: ["context-mode"]` uses bare command name. If installed via npm globally, it may be in a different location than `~/.local/bin`.

## Affected Areas

- `src/components/plugin.ts` — **Primary target**. Must be split into event/sound plugin + SDD Integration component
- `src/components/registry.ts` — Capability map must be updated with new component
- `src/config/schema.ts` — `ComponentId` union must include new component(s)
- `src/components/types.ts` — `ComponentId` union must include new component(s)
- `src/presets/definitions.ts` — Presets must be replanned
- `src/commands/install.ts` — Component factory map must be updated
- `src/commands/doctor.ts` — Doctor factory map and fix handlers must be updated
- `src/commands/preflight.ts` — FILE_TOUCH_MAP and DEPENDENCY_MAP must be updated
- `src/tui/screens/install.ts` — TUI will reflect new components automatically via status collection
- `src/opencode-config.ts` — May need new registration helpers for SDD Integration
- `install.sh` — May need PATH validation for MCP binaries
- `README.md` — Documentation must reflect new structure
- `tests/plugin.patch.test.ts` — Tests for patching behavior must move to SDD Integration
- `tests/plugin-registration.test.ts` — May need updates for new component boundaries

## Approaches

### Approach 1: Split `plugin` into `opencode-plugin` + `sdd-integration`

Create a new `sdd-integration` component that handles:
- Patching `sdd-phase-common.md` (Section E/F)
- Optional: registering SDD review agents in `opencode.json`
- Optional: patching `sdd-*` agent prompts

The existing `plugin` component becomes purely the OpenCode event/sound runtime plugin:
- Installs `cyberpunk.ts` to plugins directory
- Registers `./plugins/cyberpunk` in `opencode.json`
- No more SDD patching

**Pros:**
- Clean separation of concerns
- SDD Integration can be optional/conditional
- User-facing name makes sense ("OpenCode Plugin" vs "SDD Integration")
- Existing component interface (`ComponentModule`) works without changes
- All existing infrastructure (doctor, status, preflight, TUI) works automatically

**Cons:**
- Migration complexity: existing users have `plugin` installed with patching applied; need upgrade path
- Two components where there was one increases TUI complexity slightly
- Need to handle uninstall of old `plugin` patching when migrating

**Effort:** Medium

### Approach 2: Keep `plugin` but add `enabled` flag for SDD patching

Add a configuration flag `plugin.sddIntegration: boolean` that controls whether patching runs.

**Pros:**
- Minimal code changes
- No new component to create

**Cons:**
- Doesn't solve the naming problem — "plugin" still doesn't explain what it does
- Doesn't separate concerns conceptually
- SDD patching is still bundled with the runtime plugin
- Confusing for users who don't use SDD

**Effort:** Low

### Approach 3: Rename `plugin` to `opencode-events` and extract SDD as separate component

Rename the current `plugin` to `opencode-events` (or `opencode-sounds`) to be descriptive, and create `sdd-integration` as a separate component.

**Pros:**
- User-facing name is clear
- Clean separation
- Presets can be rebuilt around the new naming

**Cons:**
- Breaking change for existing configs (component renamed)
- Migration needed for existing users
- More work than Approach 1

**Effort:** Medium-High

### Recommendation: Approach 1 + naming refinement

Split `plugin` into two components:
1. **`opencode-plugin`** (new name, replaces `plugin`) — the runtime event/sound plugin. Installs `cyberpunk.ts`, registers in `opencode.json`, plays sounds for OpenCode events.
2. **`sdd-integration`** (new component) — optional SDD integration. Patches `sdd-phase-common.md`, registers SDD review agents, patches agent prompts. Detects SDD presence or asks user.

This gives us:
- Clear naming: "OpenCode Plugin" tells users what it does
- Optional SDD: not all users need it
- Clean component boundaries
- Reusable component interface

### Proposed new presets (for OpenCode focus)

| Preset | Components | Description |
|--------|-----------|-------------|
| `minimal` | `opencode-plugin`, `theme` | Core cyberpunk experience |
| `token-saver-general` | `opencode-plugin`, `theme`, `context-mode` | Token optimization for general use |
| `token-saver-dev` | `opencode-plugin`, `theme`, `context-mode`, `rtk`, `codebase-memory` | Full token optimization for developers |
| `developer-toolkit` | `opencode-plugin`, `theme`, `context-mode`, `rtk`, `codebase-memory`, `sdd-integration` | Developer toolkit with SDD |
| `cyberpunk-full` | All components | Full cyberpunk experience |
| `custom` | User picks | Manual selection |
| `observability` (advanced) | `otel`, `otel-collector` | Optional observability layer |

### SDD Integration detection strategy

The `sdd-integration` component should:
1. Check if `~/.config/opencode/skills/_shared/sdd-phase-common.md` exists
2. If yes → offer to integrate (or auto-integrate with confirmation)
3. If no → skip silently or warn that SDD files not found
4. Store integration state in config so it doesn't re-ask

### codebase-memory MCP path fix

Change MCP config from:
```json
"command": ["codebase-memory-mcp"]
```
To:
```json
"command": ["~/.local/bin/codebase-memory-mcp"]
```
Or resolve the absolute path at install time using `which codebase-memory-mcp` or checking `~/.local/bin/codebase-memory-mcp`.

Same fix applies to `context-mode` MCP config.

## Risks

1. **Migration of existing users** — Users who already have `plugin` installed with SDD patching applied need a smooth upgrade path. The `plugin` component ID change to `opencode-plugin` will break existing configs unless handled.

2. **Duplicate patching** — During transition, both old `plugin` and new `sdd-integration` could try to patch `sdd-phase-common.md`. Need idempotent markers to prevent conflicts.

3. **Preset backward compatibility** — Old preset names (`minimal`, `full`, `wsl`, `mac`) will need mapping to new component IDs.

4. **TUI complexity** — Adding more components and presets increases TUI screen complexity. Need to ensure the install flow remains navigable.

5. **MCP path resolution** — Using absolute paths in MCP config may break if the user moves their home directory or uses a different installation method.

## Ready for Proposal

**Yes.** The exploration provides sufficient detail to write a proposal with:
- Clear intent: separate OpenCode event plugin from SDD Integration
- Component boundary definitions
- New preset definitions
- Migration strategy for existing users
- Known bug fixes (MCP path resolution)
- Risk assessment

The orchestrator should proceed to `sdd-propose` to create a formal change proposal.
