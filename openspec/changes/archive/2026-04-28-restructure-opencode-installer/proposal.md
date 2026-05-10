# Proposal: Restructure OpenCode Installer

## Intent

Separate runtime OpenCode behavior from optional SDD patching for modular macOS/Linux installs with an explicit OS→Tool→Preset installer flow.

## Scope

### In Scope
- OpenCode-first macOS/Linux redesign; Claude/Codex later (future/disabled only).
- Split current `plugin` responsibilities now into `opencode-event-sounds` and optional `sdd-integration`.
- Rename runtime plugin to **OpenCode Event Sounds** (`opencode-event-sounds`): explicitly describes `cyberpunk.ts` event hooks and sounds.
- Add detectable/opt-in `sdd-integration` for SDD patching and doctor/preflight.
- **Explicit installer/TUI flow**: user must first choose/confirm OS (macOS/Linux; auto-detected default), then choose tool/environment (OpenCode only implemented; Claude/Codex visible as future/disabled/not-implemented if shown), then see OpenCode presets. Presets appear only after OS and tool selection.
- **OpenCode-only scope enforcement**: Claude/Codex MUST NOT expose OpenCode-specific components. Component-target mapping prevents cross-agent leakage.
- Replan presets: Minimal, Token Saver General, Token Saver Dev, Developer Toolkit, Cyberpunk Full Experience, Custom; Observability advanced optional.
- Fix macOS codebase-memory MCP PATH failure: `Executable not found in $PATH: "codebase-memory-mcp"`.
- **Clean verification policy**: no partial verify accepted. Full verify must pass clean (0 CRITICAL, 0 WARNING). Existing baseline/infrastructure failures must be fixed or converted into explicit passing/skipped behavior with rationale. `bun run typecheck` must be reproducible.
- Preserve behavior; migrate old `plugin` id and presets.

### Out of Scope
- Browser automation.
- Claude/Codex installers/adapters beyond roadmap placeholders or disabled display.
- Git helpers implementation unless already supported; roadmap only.

## Capabilities

### New Capabilities
- `sdd-integration`: Optional SDD detection, patching, doctor/preflight, marker ownership.
- `installer-flow`: Explicit OS→Tool→Preset multi-phase installer with gating.

### Modified Capabilities
- `cyberpunk-install`: IDs, aliases, presets, migration, MCP path resolution, OS→tool→preset flow.
- `plugin-registration`: Follow `opencode-event-sounds`; preserve `./plugins/cyberpunk`.
- `plugin-sound-events`: Runtime behavior unchanged under clearer ownership.
- `doctor`: Move SDD patch checks from plugin to `sdd-integration`; validate codebase-memory MCP executable path.
- `sdd-ctx-stats`: Managed by `sdd-integration`, not the runtime sound plugin.
- `tui-install`: Multi-phase install screen: OS selection → Tool selection → Preset/Manual → Confirm.

## Approach

Refactor boundaries without changing `cyberpunk.ts` runtime semantics. Keep old `plugin` as an alias to `opencode-event-sounds`; map old presets (`minimal`, `full`, `wsl`, `mac`) to nearest new presets with warnings/docs. Install SDD integration only when selected and SDD files are detected or confirmed. Resolve MCP commands to absolute or verified executable paths during install/doctor repair. TUI install screen becomes multi-phase: OS→Tool→Preset→Confirm with Claude/Codex shown as future/disabled.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/plugin.ts` | Modified | Split sounds from SDD patching |
| `src/components/registry.ts`, `src/config/schema.ts`, `src/components/types.ts` | Modified | IDs and alias |
| `src/presets/definitions.ts` | Modified | New OpenCode-focused presets |
| `src/commands/{install,doctor,preflight}.ts` | Modified | Factories, checks, dependency/file maps |
| `src/components/codebase-memory.ts` | Modified | Fix MCP executable path |
| `src/tui/screens/install.ts` | Modified | Multi-phase OS→Tool→Preset flow |
| `src/tui/types.ts` | Modified | New install phases (os-select, tool-select) |
| `src/detection/agents/*.ts` | Modified | OpenCode active; Claude/Codex disabled/future markers |
| `README.md`, `tests/` | Modified | Migration docs/tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing configs reference `plugin` | Med | Alias and migrate silently with warning |
| Duplicate SDD patch ownership | Med | Idempotent markers; only `sdd-integration` patches |
| Absolute MCP path portability | Low | Resolve at install and repair via doctor |
| Multi-phase TUI complexity | Med | Phases are sequential, each is simple; back navigation supported |
| Baseline test failures block verification | Med | Fix or convert to explicit skip with rationale |

## Rollback Plan

Revert component split and presets; isolated aliases restore old `plugin` flow. SDD patch markers remain idempotent/removable. TUI flow can revert to single-phase preset selection.

## Dependencies

- Existing OpenCode config, registry, doctor/preflight infrastructure.
- `tsc` available on PATH for reproducible typecheck.

## Success Criteria

- [ ] `plugin` stops patching SDD; `sdd-integration` owns it.
- [ ] New presets and old aliases install successfully.
- [ ] codebase-memory MCP uses a path OpenCode can execute on macOS/Linux.
- [ ] TUI install flow: OS→Tool→Preset phases work sequentially; presets only appear after OS+tool confirmed.
- [ ] OpenCode is the only implemented tool; Claude/Codex shown as future/disabled.
- [ ] Claude/Codex selection does not expose OpenCode-only components.
- [ ] `bun test --max-concurrency=1` passes clean (0 fail) OR failures are explicit skips with rationale.
- [ ] `bun run typecheck` passes clean and is reproducible.
- [ ] Full verify result: 0 CRITICAL, 0 WARNING.
