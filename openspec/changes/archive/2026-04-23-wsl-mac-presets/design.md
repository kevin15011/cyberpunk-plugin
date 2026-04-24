# Design: WSL and mac Presets

## Technical Approach

Extend the existing preset registry rather than adding a new preset subsystem. `wsl` and `mac` become first-class preset IDs in `src/presets/definitions.ts`; `resolvePreset()` remains the single resolution entry point, but now augments returned warnings with environment-aware mismatch notices from a tiny detector helper. Install execution, TUI selection, and per-component installers stay unchanged: preset resolution still returns plain component IDs plus warnings.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Add `wsl` and `mac` as static preset definitions | Keep rejecting them; compute presets dynamically | Static definitions match the current `PRESET_DEFINITIONS` map, keep tests simple, and preserve preset semantics as stable named bundles. |
| Add `src/platform/detect.ts` with `darwin` + WSL detection | Inline checks in `resolve.ts`; use only `process.platform` | A helper keeps platform logic isolated and reusable. WSL needs `/proc/version` inspection, which should not leak into CLI formatting code. |
| Warn on platform mismatch, do not block | Hard-fail mismatches; auto-filter components | The proposal explicitly keeps execution permissive. Existing component installers already fail safely on missing deps, so warnings are enough guardrail for this slice. |
| Keep CLI/TUI changes text-only | Add new commands or prompt branches | `PRESET_NAMES` already feeds the TUI, so new preset availability arrives automatically. Scope stays limited to help text and preset summary messaging. |

## Data Flow

```text
CLI/TUI preset choice
  -> resolvePreset(name)
  -> get preset definition
  -> detectEnvironment()
  -> merge base warnings + mismatch warning
  -> formatPresetSummary(...)
  -> runInstall(resolved.components)
```

For `wsl`, the detector returns `wsl` when `/proc/version` contains `microsoft` or `wsl`; otherwise Linux remains `linux`, and macOS remains `darwin` via `process.platform`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/presets/definitions.ts` | Modify | Expand `PresetId`; add `wsl` = `plugin, theme, sounds, tmux` and `mac` = `plugin, theme, sounds, context-mode, rtk`; attach platform-specific base warnings. |
| `src/presets/resolve.ts` | Modify | Remove deferred rejection, call detector, and append mismatch warnings while preserving current copy-on-return behavior. |
| `src/platform/detect.ts` | Create | Provide side-effect-free environment detection helpers for preset resolution. |
| `src/cli/output.ts` | Modify | Update `--preset` help/examples and keep preset summary output able to show mismatch warnings. |
| `tests/install-presets.test.ts` | Modify | Cover new definitions, `PRESET_NAMES`, mismatch-warning behavior, and copy semantics. |
| `tests/cli-preset-execution.test.ts` | Modify | Replace deferred-error assertions with successful `wsl`/`mac` execution plus warning output checks. |
| `tests/tui-preset-behavior.test.ts` | Modify | Assert new presets appear through `PRESET_NAMES` and that warnings surface before confirmation. |

## Interfaces / Contracts

```ts
export type PresetId = "minimal" | "full" | "wsl" | "mac"

export type DetectedEnvironment = "linux" | "wsl" | "darwin"

export function detectEnvironment(): DetectedEnvironment
export function isWSL(): boolean
```

`ResolvedPreset` stays unchanged. Mismatch handling is additive: if the selected preset target does not match `detectEnvironment()`, `resolvePreset()` adds one extra warning string and still returns the original component list.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Detector logic and preset resolution | Bun tests with mocked `process.platform` and `/proc/version` reads to verify `linux`/`wsl`/`darwin` outcomes and mismatch warnings. |
| Unit | Help/disclosure text | Assert `formatHelp()` includes `minimal, full, wsl, mac` and examples remain valid. |
| Runtime | CLI preset execution path | Reuse `main()` path tests to prove summaries print and resolved component lists reach `runInstall()`. |
| Runtime | TUI preset flow | Reuse mocked `@clack/prompts` tests to prove new preset options and pre-confirmation warnings flow through unchanged UI structure. |

## Migration / Rollout

No migration required. This is a forward-only preset expansion; existing `minimal` and `full` behavior remains unchanged.

## Open Questions

- [ ] None blocking for this slice.
