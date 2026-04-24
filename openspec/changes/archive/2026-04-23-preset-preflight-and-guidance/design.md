# Design: Preset Preflight and Guidance

## Technical Approach

Add a read-only preset preflight builder that runs after `resolvePreset()` and before confirmation in CLI/TUI. It will reuse `checkPlatformPrerequisites()` plus `collectStatus()` and combine them with preset-scoped metadata for dependency relevance, installed-state disclosure, advisory file touches, and carried warnings.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Preflight ownership | New `src/commands/preflight.ts` returns a shared summary object | Duplicating logic in `index.ts` and `tui/index.ts`; embedding in `install.ts` | Current confirmation lives in `src/index.ts` and `src/tui/index.ts`, while `runInstall()` only executes installers. A shared read-only command matches existing command-layer orchestration without changing install behavior. |
| Dependency readiness model | Derive readiness from one global prerequisite snapshot, then map only relevant checks onto preset components | Calling each installer in dry-run mode; adding per-component readiness methods | The repo already centralizes prerequisite detection in `components/platform.ts`. Reusing that avoids side effects and keeps this slice lightweight. |
| File-touch disclosure | Static advisory metadata in preflight module, limited to known paths/managed blocks | Introspecting component code dynamically; promising exact diff previews | Component installers already encode concrete target paths, but not as reusable metadata. A static map is stable for this slice and supports the proposal's “advisory” wording. |

## Data Flow

```text
resolvePreset(name)
  -> buildPresetPreflight(resolved)
       -> checkPlatformPrerequisites()
       -> collectStatus(resolved.components)
       -> merge preset warnings + mismatch warning
       -> attach dependency readiness + file-touch advisories
  -> formatPresetPreflight(...)
  -> user confirm
  -> runInstall(resolved.components)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/commands/preflight.ts` | Create | Build `PresetPreflightSummary` from preset, status, prerequisites, warnings, and advisory file-touch metadata. |
| `src/presets/definitions.ts` | Modify | Add shared preset/preflight types if needed, but keep preset registry unchanged. |
| `src/cli/output.ts` | Modify | Replace the current preset-only formatter with a sectioned preflight formatter for CLI/TUI reuse. |
| `src/index.ts` | Modify | Run preflight before preset-driven CLI install and print the richer disclosure before execution. |
| `src/tui/index.ts` | Modify | Show the same preflight summary in the preset confirmation note before prompting. |

## Interfaces / Contracts

```ts
interface PreflightDependencyStatus {
  id: "ffmpeg" | "npm" | "bun" | "curl"
  label: string
  requiredBy: ComponentId[]
  available: boolean
  severity: "info" | "warn"
  message: string
}

interface ComponentPreflightStatus {
  id: ComponentId
  installed: boolean
  readiness: "ready" | "degraded"
  dependencyIds: PreflightDependencyStatus["id"][]
  fileTouches: string[]
}

interface PresetPreflightSummary {
  preset: ResolvedPreset
  components: ComponentPreflightStatus[]
  dependencies: PreflightDependencyStatus[]
  warnings: string[]
  notes: string[]
}
```

Known file touches stay advisory and explicit, e.g. plugin -> `~/.config/opencode/plugins/cyberpunk.ts`, theme -> `~/.config/opencode/themes/cyberpunk.json` and `tui.json`, sounds -> `~/.config/opencode/sounds/*.wav`, context-mode/rtk -> routing docs plus `opencode.json`, tmux -> managed block in `~/.tmux.conf`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Preflight aggregation for minimal/full/mac/wsl presets | Stub prerequisites + statuses, assert dependency grouping, installed flags, warnings, and advisory file touches. |
| Unit | Formatter output | Snapshot-style string assertions for concise CLI/TUI sections and degraded readiness messaging. |
| Integration | CLI preset path | Exercise `main()` with `install --preset ...`, assert preflight renders before `runInstall()` and does not block mismatched presets. |

## Migration / Rollout

No migration required. This is a confirmation-time disclosure change only.

## Open Questions

- [ ] Should `npm` and `bun` be collapsed into one displayed dependency row (`npm/bun`) to match doctor wording, or shown separately when mapping readiness to `context-mode`?
- [ ] Should already-installed components be labeled as "already installed" while still remaining in the preset execution set, or merely shown as ready/skippable?
