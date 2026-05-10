# Design: Restructure OpenCode Installer

## Technical Approach

Split the current `plugin` component into a runtime-only OpenCode event-sounds installer plus a new optional `sdd-integration` component. Keep OpenCode behavior and `./plugins/cyberpunk` registration stable; move all `sdd-phase-common.md` Section E/F ownership out of `PLUGIN_SOURCE` and into marker-based component helpers. Presets become OpenCode macOS/Linux-first bundles with aliases for old names. Install flow becomes explicit multi-phase: OS selection → Tool selection → Preset/Manual selection → Confirm.

## Architecture Decisions

| Decision | Choice | Alternatives / Tradeoff | Rationale |
|---|---|---|---|
| Runtime component id | Keep internal `ComponentId` `plugin`; change label to `OpenCode Event Sounds` and description/docs to `opencode-event-sounds`. | New id `opencode-event-sounds` is clearer but forces config migration, wider type churn, and broken saved configs. | Preserves `components.plugin`, doctor IDs, tests, and old CLI behavior while improving user-facing naming. Add a compatibility alias layer so future migration remains possible. |
| SDD ownership | Create `src/components/sdd-integration.ts`; remove SDD constants/functions/imports from `PLUGIN_SOURCE` and plugin install. | Leave patching in plugin and hide via preset selection. | Eliminates runtime plugin side effects and duplicate ownership; SDD patching becomes explicit, detectable, uninstallable. |
| OpenCode scope | Implement OpenCode macOS/Linux flow now; leave Claude/Codex as capability metadata/roadmap only. | Build adapters for all agents now. | Proposal is OpenCode-first; avoids unverified extension surfaces. |
| TUI install flow | Multi-phase: `os-select` → `tool-select` → `preset` → `confirm` (was `preset` → `confirm`). | Single-phase preset list. | User must explicitly choose OS and tool before seeing presets; prevents confusion about which components apply to which agent. |
| Claude/Codex display | Show as "Coming soon / Not yet implemented" if visible at all; selection returns informational message, not install flow. | Hide entirely. | Sets expectations; users know the tool exists but isn't ready. |
| Clean verification | All baseline failures fixed or converted to explicit skip/pass; no partial acceptance. | Accept partial with known-failures list. | Partial verify masks regressions; clean baseline is required for reliable CI. |

## Data Flow

```text
TUI install flow:
  os-select → detectEnvironment() auto-fills default → user confirms/changes
  tool-select → show OpenCode (active), Claude/Codex (disabled/future) → user selects OpenCode
  preset → resolvePreset with OS context → show applicable presets
  confirm → runInstall

CLI flow:
  detectEnvironment() → validate --target opencode → resolvePreset → runInstall

preset/CLI alias ──→ resolvePreset/normalizeComponentIds ──→ runInstall
                                                     ├─ plugin: writes cyberpunk.ts + registers ./plugins/cyberpunk
                                                     ├─ sdd-integration: detect → patch/unpatch/doctor
                                                     └─ codebase-memory: resolve executable → patch opencode.json MCP

doctor --fix ──→ component doctors ──→ fix handlers call component repair helpers
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/plugin.ts` | Modify | Rename label usage, remove SDD patch constants/helpers from installed `PLUGIN_SOURCE`, stop calling `patchSddPhaseCommon()` in install, remove `plugin:patching` checks. Keep file path `cyberpunk.ts` and registration entry. |
| `src/components/sdd-integration.ts` | Create | Own `getSddIntegrationComponent()`, `detectSddPhaseCommon()`, `patchSddPhaseCommon()`, `unpatchSddPhaseCommon()`, `checkSddIntegrationDoctor()`, marker constants/templates. |
| `src/components/types.ts`, `src/config/schema.ts` | Modify | Add `sdd-integration`; keep `plugin`; add labels. Defaults include `sdd-integration: { installed:false }`. |
| `src/components/registry.ts` | Modify | Add `sdd-integration` supported on OpenCode linux/wsl/darwin; leave Claude/Codex unknown. |
| `src/commands/install.ts`, `src/commands/doctor.ts`, `src/commands/status.ts` | Modify | Register factory; move fix handling from `plugin:patching` to `sdd-integration:patching`; status/doctor use new component. |
| `src/commands/preflight.ts` | Modify | Add file touches for `~/.config/opencode/skills/_shared/sdd-phase-common.md`; no tool dependency. |
| `src/presets/definitions.ts`, `src/presets/resolve.ts` | Modify | New presets plus `PRESET_ALIASES`; old `minimal/full/wsl/mac` resolve with warning. Custom remains caller-selected component list, not a stored preset id. |
| `src/components/codebase-memory.ts` | Modify | Resolve MCP command to absolute executable path and validate in doctor. |
| `src/tui/types.ts` | Modify | Extend `InstallPhase` to include `"os-select" | "tool-select"` before `"preset"`. Add `selectedOS` and `selectedTool` fields to `TUIState`. |
| `src/tui/screens/install.ts` | Modify | Add `os-select` phase (detect default, allow change), `tool-select` phase (OpenCode active, Claude/Codex disabled/future). Preset list only renders after both selected. |
| `src/detection/agents/claude.ts` | Modify | Add `implemented: false` marker to detection result for TUI display. |
| `src/detection/agents/codex.ts` | Modify | Add `implemented: false` marker to detection result for TUI display. |
| `README.md`, `tests/*` | Modify/Create | Document migration and cover aliases, SDD component, plugin source, MCP path, OS→tool→preset flow. |

## Interfaces / Contracts

- Component IDs: add `"sdd-integration"`; keep `"plugin"` as compatibility id.
- Presets: `minimal`, `token-saver-general`, `token-saver-dev`, `developer-toolkit`, `cyberpunk-full`; aliases map `full→cyberpunk-full`, `wsl/mac→developer-toolkit` with platform warning.
- SDD patch contract: only replace content between `<!-- cyberpunk:start:section-e -->` and `<!-- cyberpunk:end:section-e -->`; if absent, insert before existing `## E.` or append; unpatch removes only marked block; missing SDD file is `skipped/warn`, not error.
- Preflight: `sdd-integration` reports detection note and file touch; install may skip unless selected and SDD file exists or user confirms through existing CLI/TUI selection.
- Codebase-memory: `resolveCodebaseMemoryExecutable()` returns `~/.local/bin/codebase-memory-mcp` when executable, else PATH result when absolute/verified; `opencode.json` uses `command: [absolutePath]`.
- TUI install phases: `os-select` → `tool-select` → `preset` | `manual` → `confirm`. Back navigation supported at each phase. OS auto-detected via `detectEnvironment()` but user must confirm or change. Tool list: OpenCode (active), Claude/Codex (disabled, labeled "Coming soon"). Presets only rendered after both OS and tool confirmed.
- Claude/Codex scope: `AgentDetectResult` extended with optional `implemented: boolean`. When `implemented === false`, TUI shows disabled entry. Selecting a disabled tool shows informational message, does NOT enter preset flow.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `PLUGIN_SOURCE` has only sound hooks, no SDD patch strings | Update plugin patch/source tests. |
| Unit | SDD patch/unpatch idempotence, drift replacement, missing file handling | New `tests/sdd-integration.test.ts` with temp HOME. |
| Unit | Preset aliases and new bundles | Update preset/preflight/TUI tests. |
| Unit | codebase-memory absolute MCP path and doctor failures | Extend `tests/codebase-memory.test.ts` and doctor scenarios. |
| Unit | OS→tool→preset TUI phases: sequential gating, back navigation, disabled tool selection | New/extend `tests/tui-install-flow.test.ts`. |
| Unit | Claude/Codex detection returns `implemented: false` | Update agent detector tests. |
| Quality | Type safety | `bun test --max-concurrency=1`; `bun run typecheck`. |
| Quality | Clean baseline | All tests pass OR explicit skip with rationale; 0 fail. |

## Migration / Rollout

Existing configs keep `components.plugin`; label changes only. Old presets continue through aliases and warnings. Existing SDD markers remain compatible because the same markers move to `sdd-integration`; uninstall removes only managed marker blocks. Doctor can repair missing `sdd-integration` patching and rewrite codebase-memory MCP paths safely. TUI install flow adds OS→tool phases before existing preset selection; back navigation preserves earlier choices.

## Open Questions

- [x] Should CLI auto-select `sdd-integration` when SDD files are detected, or only recommend it in preflight/TUI? Design supports both; safer default is recommend-only.
- [x] Should Claude/Codex be hidden entirely or shown as disabled? Decision: show as disabled/future with informational message on selection. Sets user expectations.
