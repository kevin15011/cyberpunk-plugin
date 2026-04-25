# Exploration: Multi-Agent Windows Installer

## Current State

### Architecture Overview

The cyberpunk-plugin is a Bun/TypeScript CLI compiled to a standalone binary. It manages a dev environment centered around **OpenCode** (an AI coding assistant), with components installed into `~/.config/opencode/`. The architecture follows a **component module pattern**:

```
src/
├── index.ts              — argv parse → command dispatch (tui/install/uninstall/status/upgrade/config/doctor/help)
├── cli/                  — parse-args.ts, output.ts (text formatters)
├── commands/             — install.ts, status.ts, doctor.ts, upgrade.ts, config.ts, preflight.ts
├── components/           — plugin.ts, theme.ts, sounds.ts, context-mode.ts, rtk.ts, tmux.ts, types.ts, platform.ts
├── config/               — schema.ts, load.ts, save.ts (CyberpunkConfig in ~/.config/cyberpunk/config.json)
├── platform/             — detect.ts (linux/wsl/darwin only)
├── presets/              — definitions.ts (minimal/full/wsl/mac), resolve.ts
└── tui/                  — index.ts (raw mode loop), app.ts (model/update/view), router.ts, screens/*, theme.ts
```

### Component Model

Each component implements `ComponentModule`:
- `id: ComponentId` — union type: `"plugin" | "theme" | "sounds" | "context-mode" | "rtk" | "tmux"`
- `label: string` — display name
- `install(): Promise<InstallResult>`
- `uninstall(): Promise<InstallResult>`
- `status(): Promise<ComponentStatus>`
- `doctor?(ctx: DoctorContext): Promise<DoctorResult>`

Components are registered in a factory map (`COMPONENT_FACTORIES`) in `commands/install.ts`, `commands/status.ts`, and `commands/doctor.ts`. The install command iterates over selected IDs, calls the factory, and invokes the appropriate method.

### Platform Detection

`src/platform/detect.ts` is minimal:
- `detectEnvironment()` returns `"linux" | "wsl" | "darwin"`
- Uses `process.platform` and `/proc/version` for WSL detection
- **No Windows native support** — `win32` is not handled at all

### OpenCode Coupling (Deep)

The coupling to OpenCode is pervasive:

1. **Config paths**: All components use `~/.config/opencode/` as the base directory
2. **Plugin system**: `opencode-config.ts` reads/writes `~/.config/opencode/opencode.json`
3. **Theme**: Writes to `~/.config/opencode/themes/cyberpunk.json` and `~/.config/opencode/tui.json`
4. **Sounds**: Uses `~/.config/opencode/sounds/`
5. **Plugin source**: Installs to `~/.config/opencode/plugins/cyberpunk.ts`
6. **context-mode**: Configures MCP in `opencode.json`, writes routing to `~/.config/opencode/instructions/`
7. **rtk**: Same instruction directory pattern
8. **TUI labels**: "Plugin de OpenCode", references to OpenCode throughout
9. **Banner**: "CYBERPUNK ENVIRONMENT MANAGER" — generic enough
10. **Plugin source code**: The installed `cyberpunk.ts` imports `@opencode-ai/plugin` and uses `$` template literal syntax specific to OpenCode

### TUI Structure

The TUI uses a custom raw-mode terminal loop (not blessed/ink/bubbletea):
- State machine with routes: home → install/uninstall/status/doctor/upgrade → task → results
- Install screen has 3 phases: preset selection → manual component selection → confirmation
- All copy is in Spanish
- No emoji usage (good — matches the requirement)

### Binary Distribution

- `build.ts` uses `bun build --compile` to produce a standalone binary
- `install.sh` downloads from GitHub Releases based on `uname -s`/`uname -m`
- Published for: Linux x64/arm64, macOS arm64 (Intel deprecated)
- **No Windows binary target**

## Affected Areas for Multi-Agent Windows

| Area | Coupling Level | Reusability for Claude/Codex |
|------|---------------|------------------------------|
| `ComponentModule` interface | Low — generic pattern | **Highly reusable** |
| `install.ts` orchestration | Low — iterates factories | **Reusable** |
| `status.ts` collection | Low — iterates factories | **Reusable** |
| `doctor.ts` aggregation | Medium — has OpenCode-specific fix handlers | **Partially reusable** |
| `config/schema.ts` | Medium — hardcoded ComponentId union | **Needs generalization** |
| `config/load.ts` / `save.ts` | Low — generic JSON I/O | **Reusable** |
| `platform/detect.ts` | High — no win32 support | **Needs rewrite** |
| `cli/parse-args.ts` | Low — generic arg parsing | **Reusable** |
| `tui/*` (screens, router, app) | Medium — OpenCode labels, Spanish copy | **Reusable with rebranding** |
| `components/plugin.ts` | **Very High** — OpenCode-specific paths, plugin format, SDD patching | **Not reusable** |
| `components/theme.ts` | **Very High** — `~/.config/opencode/themes/` | **Not reusable** |
| `components/sounds.ts` | Low — generic ffmpeg generation | **Reusable** |
| `components/context-mode.ts` | **Very High** — OpenCode MCP config, routing files | **Not reusable** |
| `components/rtk.ts` | Medium — generic binary install + routing | **Partially reusable** |
| `components/tmux.ts` | Low — generic marker-managed config | **Reusable** |
| `presets/definitions.ts` | Medium — references current ComponentIds | **Needs generalization** |
| `opencode-config.ts` | **Very High** — OpenCode-specific | **Not reusable** |
| `install.sh` | High — Unix-only, curl-based | **Needs PowerShell equivalent** |
| `build.ts` | Low — bun build --compile | **Reusable** (Bun supports Windows) |

## Windows Blockers

### 1. Platform Detection
- `detectEnvironment()` does not handle `process.platform === "win32"`
- `isWSL()` only checks `/proc/version` (Linux-only)
- `getPlaybackDependency()` returns `paplay` for non-darwin (Linux PulseAudio)
- No Windows audio equivalent mapping (`powershell -c [System.Media.SoundPlayer]` or similar)

### 2. Path Assumptions
- **ALL** components use `~/.config/opencode/` via `process.env.HOME || process.env.USERPROFILE || "~"`
- On Windows, `process.env.USERPROFILE` works but `~` does not expand in all contexts
- Unix paths like `~/.config/opencode/plugins/cyberpunk.ts` need Windows equivalents
- Tmux config uses `~/.tmux.conf` — tmux is not native to Windows (WSL-only)

### 3. Shell/Binary Assumptions
- `install.sh` is bash-only — needs PowerShell equivalent
- `which` command used extensively for binary detection — Windows uses `where`
- `chmod +x` in install.sh — not applicable on Windows
- `xattr` for macOS quarantine — Windows has Zone.Identifier ADS
- `curl -fsSL` — Windows has `curl.exe` but flags may differ
- `ffmpeg` generation uses Unix shell syntax in execSync

### 4. Symlink/Unix Commands
- No explicit symlink usage found (good)
- `execSync` commands use Unix-style paths and shell syntax
- `which` → needs `where` or `Get-Command` on Windows
- `2>/dev/null` → `2>$null` in PowerShell

### 5. Config Locations
- Current: `~/.config/cyberpunk/config.json`
- Windows equivalent: `%APPDATA%\cyberpunk\config.json` or `%LOCALAPPDATA%\cyberpunk\config.json`
- OpenCode-specific configs would need Claude Code / Codex equivalents:
  - Claude Code: `~/.claude/` (may exist on Windows)
  - Codex: Unknown config surface — needs research

### 6. Binary Distribution
- `bun build --compile` supports Windows — can produce `cyberpunk.exe`
- GitHub Releases need `cyberpunk-win32-x64.exe` and `cyberpunk-win32-arm64.exe` assets
- `install.sh` needs a PowerShell equivalent (`install.ps1`)

## Reusable Pieces for Claude/Codex

### Highly Reusable (no changes needed)
1. **ComponentModule interface** — generic install/uninstall/status/doctor pattern
2. **Install orchestration** (`commands/install.ts`) — factory-based iteration
3. **Status collection** (`commands/status.ts`) — same pattern
4. **Config load/save** — generic JSON with schema validation
5. **TUI framework** — raw-mode loop, router, screen pattern
6. **Task execution pipeline** — hooks, progress display, results
7. **Doctor framework** — check/fix/summary pattern
8. **Sounds component** — ffmpeg generation is platform-agnostic
9. **Tmux component** — if targeting WSL users
10. **Build system** — bun compile works on Windows

### Partially Reusable (needs adaptation)
1. **RTK component** — binary download pattern is reusable, but OpenCode plugin registration is not
2. **Doctor command** — aggregation logic is reusable, but fix handlers are OpenCode-specific
3. **Presets** — concept is reusable, but definitions need new agent-target mappings
4. **Platform detection** — needs win32 support added

### Not Reusable (agent-specific)
1. **Plugin component** — OpenCode plugin format, SDD patching, `@opencode-ai/plugin` import
2. **Theme component** — OpenCode theme JSON format, `~/.config/opencode/themes/`
3. **Context-mode component** — OpenCode MCP configuration, routing instructions
4. **OpenCode config module** — `opencode.json` read/write

## Proposed Concepts

### Environment
Represents the detected runtime environment. Extends current `DetectedEnvironment`:
```typescript
type Environment = "linux" | "wsl" | "darwin" | "windows" | "windows-wsl"
```
- `windows` = native Windows (cmd/PowerShell)
- `windows-wsl` = Windows running WSL (tmux available inside WSL)

### AgentTarget
Represents an AI coding agent that can be configured:
```typescript
type AgentTarget = "opencode" | "claude" | "codex"
```
Each agent has:
- Config directory (e.g., `~/.config/opencode/`, `~/.claude/`, TBD for Codex)
- Plugin/extension mechanism
- Theme format
- MCP/instruction support

### ComponentCompatibility
A component declares which agents it supports:
```typescript
interface ComponentModule {
  supportedAgents: AgentTarget[]  // e.g., ["opencode", "claude"]
  // ... existing interface
}
```

### DetectionResult
Rich result from environment + agent detection:
```typescript
interface DetectionResult {
  environment: Environment
  detectedAgents: {
    opencode: { installed: boolean; version?: string; configPath?: string }
    claude: { installed: boolean; version?: string; configPath?: string }
    codex: { installed: boolean; version?: string; configPath?: string }
  }
  prerequisites: {
    ffmpeg: boolean; npm: boolean; bun: boolean; curl: boolean; git: boolean
    powershell: boolean; dotnet: boolean  // Windows-specific
  }
}
```

### RecommendedAction
Based on detection, recommend what to install:
```typescript
interface RecommendedAction {
  type: "install" | "configure" | "skip" | "warn"
  component: string
  reason: string
  priority: "high" | "medium" | "low"
}
```

### UserProfile
Determines UI complexity and default selections:
```typescript
type UserProfile = "non-technical" | "developer" | "admin"
```
- **Non-technical**: Guided wizard, pre-selected "recommended" components, minimal options
- **Developer**: Full component selection, preset support, manual override
- **Admin**: Silent/ scripted install, GPO/MDM deployment support

## Known Unknowns

### Claude Code on Windows
1. **Config location**: Is it `~/.claude/` on Windows? Does it use `%APPDATA%`?
2. **Plugin/extension surface**: Does Claude Code have a plugin system? If so, what format?
3. **Theme support**: Can Claude Code accept custom themes? What format?
4. **MCP support**: Does Claude Code support MCP servers like OpenCode?
5. **Instructions directory**: Does it have an equivalent to `~/.config/opencode/instructions/`?
6. **Event system**: Does it have event hooks (session.idle, session.error, etc.) for sound playback?

### Codex on Windows
1. **What is Codex?**: Need to clarify — is this OpenAI Codex (deprecated), or a different tool?
2. **Config location**: Unknown
3. **Extension mechanism**: Unknown
4. **Theme support**: Unknown

### Windows-Specific
1. **PowerShell execution policy**: `install.ps1` may be blocked by default execution policy
2. **Windows Defender**: May flag the compiled binary as suspicious
3. **PATH manipulation on Windows**: Registry vs. environment variable approach
4. **Audio playback on Windows**: Best approach for notification sounds (SystemSounds, PowerShell, or bundled player)
5. **Tmux on Windows**: Only available via WSL — need to decide if native Windows terminal config is in scope (Windows Terminal has its own settings.json)

### Build/Distribution
1. **Bun compile on Windows**: Does `bun build --compile` produce a working `.exe` with all Node.js builtins?
2. **GitHub Actions**: Need Windows build runners for CI
3. **Code signing**: Windows requires Authenticode signing for trusted distribution

## Suggested Implementation Slices

### Slice 1: Foundation (Infrastructure)
- Extend `DetectedEnvironment` to include `"windows"`
- Add Windows platform detection (`process.platform === "win32"`)
- Add `which` → `where`/`Get-Command` abstraction for binary detection
- Add Windows config path resolution (`%APPDATA%` / `%LOCALAPPDATA%`)
- Add Windows prerequisite checks (PowerShell, .NET)
- Tests: Unit tests for platform detection, path resolution

### Slice 2: Component Model Generalization
- Generalize `ComponentId` from hardcoded union to extensible registry
- Add `supportedAgents` to `ComponentModule`
- Create agent-agnostic config path resolution (replace hardcoded `~/.config/opencode/`)
- Refactor `config/schema.ts` to support multiple agents
- Tests: Component registry, path resolution per agent

### Slice 3: Detection Engine
- Create `DetectionResult` type and detection engine
- Detect installed agents (OpenCode, Claude, Codex)
- Detect prerequisites per platform
- Generate `RecommendedAction` list based on detection
- Tests: Detection scenarios, recommendation logic

### Slice 4: Windows Binary + Installer
- Add Windows targets to `build.ts`
- Create `install.ps1` equivalent of `install.sh`
- Handle PowerShell execution policy guidance
- Add Windows-specific PATH manipulation
- Tests: Install script parsing, PATH detection

### Slice 5: Agent-Specific Components (Claude)
- Research Claude Code config/extension surface
- Create Claude plugin component (if extension surface exists)
- Create Claude theme component (if theme support exists)
- Create Claude MCP/instruction component (if applicable)
- Tests: Component install/uninstall/status

### Slice 6: TUI Rebranding + User Profiles
- Remove Spanish copy, replace with professional English
- Add user profile detection/selection
- Add "recommended" component selection based on detection
- Add Windows-specific TUI screens (if needed)
- Tests: TUI navigation, profile-based defaults

### Slice 7: Codex Support (Deferred)
- Depends on resolving "Known Unknowns" about Codex
- Same pattern as Claude once config surface is known

## Risks

1. **Claude Code extension surface may not exist** — If Claude Code has no plugin/theme/MCP support, the multi-agent value proposition shrinks significantly. RTK and context-mode may still be installable as standalone tools.

2. **Codex ambiguity** — Without clarity on what "Codex" refers to, this target cannot be scoped.

3. **Windows binary compatibility** — `bun build --compile` may have edge cases with Windows-specific Node.js builtins (e.g., `fs` path handling, child_process shell syntax).

4. **Deep OpenCode coupling** — The plugin component alone is 537 lines of OpenCode-specific code. Extracting agent-agnostic patterns will require significant refactoring.

5. **Tmux on Windows** — tmux is not native to Windows. The tmux component is only useful for WSL users. A Windows Terminal component would be needed for native Windows users.

6. **Spanish copy throughout** — All UI text, error messages, and labels are in Spanish. Converting to professional English is a large surface area change.

7. **Component interdependencies** — Some components depend on others (e.g., context-mode requires npm, sounds requires ffmpeg). The detection engine must handle these gracefully.

## Ready for Proposal

**Yes** — sufficient information has been gathered to create a change proposal. The exploration identifies:
- Clear separation between reusable infrastructure (component model, TUI framework, doctor system) and agent-specific code (plugin, theme, context-mode)
- Specific Windows blockers with mitigation strategies
- A phased implementation approach starting with platform detection and component generalization
- Key unknowns that need validation before Claude/Codex components can be built

The recommendation is to proceed with Slices 1-4 first (foundation + detection + Windows support), then validate the Claude Code extension surface before committing to Slice 5.
