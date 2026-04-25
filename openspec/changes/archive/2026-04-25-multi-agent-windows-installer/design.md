# Design: Multi-Agent Windows Installer

## Technical Approach

Introduce agent/platform domain types first, then route existing OpenCode behavior through default adapters so current commands stay compatible. Detection becomes an environment-first service used by CLI, doctor, presets, and TUI; components declare capabilities instead of assuming `~/.config/opencode`. Claude/Codex remain detectable targets with conservative recommendations until their extension surfaces are verified.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Domain model | Add `src/domain/environment.ts` with `PlatformInfo`, `ShellInfo`, `AgentTarget`, `DetectionResult`, `ComponentCapability`, `Recommendation`, `UserProfile` | Scatter types across commands/components | Central types prevent OpenCode coupling from reappearing and support strict TypeScript unions. |
| Detection | Add registry in `src/detection/registry.ts` with `AgentDetector` entries for OpenCode, Claude, Codex | Hard-code detection in doctor/TUI | Registry allows platform-aware probes and defers unsupported adapter features safely. |
| Components | Add `ComponentAdapter`/capability metadata and keep `ComponentModule` methods | Rewrite all components around agents at once | Adapter wrapper gives low-risk parity for OpenCode while enabling target-aware recommendations. |
| Paths/commands | Add `src/platform/paths.ts` and `src/platform/shell.ts`; no raw `which`, `~`, or shell redirection in components | Inline Windows branches | One abstraction handles `APPDATA`, `LOCALAPPDATA`, PowerShell, cmd, WSL, and POSIX consistently. |
| UX | CLI/TUI starts with detection/profile/mode; text output uses professional English with no emoji | Keep Spanish OpenCode-first screens | Meets Windows enterprise goals and keeps `--json` scriptable. |

## Data Flow

```text
parseArgs/runTUI
  -> detectPlatform + detectShell -> detector registry
  -> DetectionResult -> recommendation engine
  -> component registry filters capabilities
  -> install/status/doctor adapters
  -> CyberpunkConfig v2 (with v1 compatibility normalization)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/domain/environment.ts` | Create | Shared discriminated unions and result contracts. |
| `src/platform/detect.ts` | Modify | Return rich `PlatformInfo`; add native Windows/WSL labels and playback capability. |
| `src/platform/paths.ts`, `src/platform/shell.ts` | Create | Windows-safe home/config path resolution, executable lookup, command execution descriptors. |
| `src/detection/{types,registry,agents,recommend}.ts` | Create | Detector registry, OpenCode/Claude/Codex probes, prerequisite and recommendation logic. |
| `src/components/{types,registry}.ts` | Modify/Create | Add capabilities/adapters while preserving current factories as OpenCode defaults. |
| `src/components/{plugin,theme,context-mode,rtk,sounds,tmux}.ts` | Modify | Replace hardcoded OpenCode paths and `which` calls with adapters/platform helpers. |
| `src/config/schema.ts`, `src/config/load.ts` | Modify | Add config v2 `targets`; normalize existing v1 `components` without rewriting. |
| `src/commands/{install,status,doctor,preflight}.ts` | Modify | Accept optional target/profile/mode; default to OpenCode-compatible behavior. |
| `src/cli/{parse-args,output}.ts` | Modify | Add `--target`, `--profile`, `--mode`, professional text, unchanged legacy component flags. |
| `src/tui/*` | Modify | Environment-first install flow, simple/advanced modes, professional no-emoji copy. |
| `build.ts`, `.github/workflows/release.yml`, `install.ps1` | Modify/Create | Windows `.exe` assets and PowerShell installer guidance. |

## Interfaces / Contracts

```ts
export type AgentTarget = "opencode" | "claude" | "codex"
export type UserProfile = "non-technical" | "developer" | "admin"
export interface PlatformInfo { kind: "linux"|"wsl"|"darwin"|"windows"; arch: NodeJS.Architecture; configRoot: string }
export interface ShellInfo { kind: "bash"|"zsh"|"powershell"|"cmd"|"unknown"; executable?: string }
export interface ComponentCapability { component: ComponentId; targets: AgentTarget[]; platforms: PlatformInfo["kind"][]; requires: string[]; status: "supported"|"degraded"|"unsupported"|"unknown" }
export interface DetectionResult { platform: PlatformInfo; shell: ShellInfo; agents: Record<AgentTarget, { installed: boolean; version?: string; configPath?: string }>; capabilities: ComponentCapability[] }
export interface Recommendation { component: ComponentId; target: AgentTarget; action: "install"|"skip"|"warn"|"defer"; reason: string; priority: "high"|"medium"|"low" }
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Windows path roots, shell lookup descriptors, detector parsing, recommendation filters | `bun:test` with env/process shims and no real shell mutation. |
| Compatibility | Legacy OpenCode CLI flags, config v1 normalization, component factory parity | Golden tests against current outputs/installed config shape. |
| Integration | Doctor/install preflight on mocked Windows, WSL, macOS, Linux detections | Dependency-injected fs/command runners. |
| Release | Windows asset naming and `install.ps1` URL/PATH logic | Script text tests plus GitHub Actions Windows smoke build. |

## Migration / Rollout

Phase 1: platform path/shell helpers and Windows detection. Phase 2: domain types, component registry, OpenCode adapter parity. Phase 3: detection/recommendations consumed by doctor/preflight. Phase 4: CLI/TUI profile and copy refactor. Phase 5: Windows build and `install.ps1`. Phase 6: verified Claude/Codex adapters only after research.

Existing commands (`cyberpunk install --plugin`, presets, status, doctor, TUI defaults) remain OpenCode-first. Config v1 is read as OpenCode target state; v2 is written only after install/config mutation.

## Open Questions

- [ ] Claude Code plugin/theme/MCP surfaces and Windows config path must be verified before enabling non-detection components.
- [ ] Codex target identity/config surface remains ambiguous; keep recommendations as `defer` until resolved.
