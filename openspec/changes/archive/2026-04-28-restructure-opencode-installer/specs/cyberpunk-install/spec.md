# Delta for Cyberpunk Install

## ADDED Requirements

### Requirement: OpenCode Event Sounds Component ID

The system SHALL keep `plugin` as the canonical internal `ComponentId` for the runtime sound-event plugin. The external name `opencode-event-sounds` MUST be accepted as an alias that resolves to `plugin` via `normalizeComponentId()`. The CLI flag `--plugin` MUST remain functional. The CLI flag `--opencode-event-sounds` MUST also be accepted and map to `plugin`.

#### Scenario: Old plugin id resolves

- GIVEN a config or CLI references `plugin`
- WHEN the id is resolved
- THEN it maps to `plugin` with identical behavior

#### Scenario: New id installs same artifact

- GIVEN `--plugin` or `--opencode-event-sounds` is specified
- WHEN install runs
- THEN `~/.config/opencode/plugins/cyberpunk.ts` is copied identically

### Requirement: SDD Integration Component Install

The system SHALL support `--sdd-integration` as a CLI flag and `sdd-integration` as a `ComponentId`. Install delegates to the `sdd-integration` component module.

#### Scenario: CLI flag installs SDD integration

- GIVEN `sdd-phase-common.md` exists
- WHEN `cyberpunk install --sdd-integration` runs
- THEN Section E/F patching is applied

### Requirement: Restructured OpenCode Presets

Supported presets SHALL be: `minimal` (plugin, theme), `token-saver-general` (plugin, theme), `token-saver-dev` (plugin, theme, rtk, sdd-integration), `developer-toolkit` (plugin, theme, sounds, context-mode, rtk, codebase-memory, sdd-integration), `cyberpunk-full` (all components), `custom` (TUI selection). Old preset names (`full`, `wsl`, `mac`) MUST map to nearest new presets with a deprecation warning.

#### Scenario: Old full preset maps to cyberpunk-full

- GIVEN `--preset full` is specified
- WHEN preset resolution runs
- THEN it resolves to `cyberpunk-full` and emits a deprecation warning

#### Scenario: Old mac preset maps

- GIVEN `--preset mac` is specified
- WHEN preset resolution runs
- THEN it resolves to `developer-toolkit` (or nearest match) with deprecation warning

#### Scenario: New preset installs correct components

- GIVEN `--preset developer-toolkit` is specified
- WHEN install runs
- THEN exactly the declared components are installed including `sdd-integration`

### Requirement: OS→Tool→Preset Install Flow

The install flow (TUI and CLI) SHALL follow an explicit sequence: (1) OS selection/confirmation, (2) Tool/environment selection, (3) Preset or manual component selection. Presets MUST only appear after both OS and tool are confirmed. OpenCode is the only implemented tool; Claude/Codex MUST be shown as future/disabled/not-implemented if visible.

#### Scenario: TUI shows OS selection first

- GIVEN user opens the install screen
- WHEN the screen renders
- THEN the first phase shows OS options (macOS, Linux) with auto-detected default selected

#### Scenario: TUI shows tool selection after OS

- GIVEN user has confirmed OS selection
- WHEN the screen transitions
- THEN tool options appear: OpenCode (active), Claude/Codex (disabled, labeled "Coming soon")

#### Scenario: Presets appear only after OS and tool

- GIVEN user has selected OS and chosen OpenCode
- WHEN the screen transitions
- THEN preset list renders with OpenCode-specific presets

#### Scenario: Selecting disabled tool shows info

- GIVEN user selects Claude or Codex in tool selection
- WHEN selection is confirmed
- THEN informational message appears: "Not yet implemented"; preset list does NOT render

### Requirement: OpenCode-Only Scope Enforcement

Claude/Codex tool paths MUST NOT expose OpenCode-specific components (plugin, sdd-integration, OpenCode presets). Component-target mapping SHALL prevent cross-agent leakage.

#### Scenario: Claude selection shows no OpenCode components

- GIVEN user selects Claude tool
- WHEN component list would render
- THEN no OpenCode-specific components appear

#### Scenario: OpenCode components not registered for Claude target

- GIVEN the component registry is queried for Claude target
- WHEN listing supported components
- THEN `plugin`, `sdd-integration`, `context-mode`, `rtk` are absent

### Requirement: Clean Verification Policy

The change MUST pass full verification with 0 CRITICAL and 0 WARNING findings. Existing baseline/infrastructure test failures MUST be fixed or converted into explicit passing/skipped behavior with documented rationale. `bun run typecheck` MUST be reproducible in the development environment.

#### Scenario: Full test suite passes clean

- GIVEN `bun test --max-concurrency=1` runs
- WHEN all tests complete
- THEN 0 failures (all pass or explicit skip with rationale)

#### Scenario: Typecheck is reproducible

- GIVEN `tsc` is installed as a project dependency
- WHEN `bun run typecheck` runs
- THEN it completes with exit code 0

## MODIFIED Requirements

### Requirement: ComponentId Type Expansion

The `ComponentId` type SHALL include `"sdd-integration"` alongside all existing ids. The string `"opencode-event-sounds"` MUST be accepted as an alias that resolves to `"plugin"`.

(Previously: ComponentId only included `"plugin"` without alias support.)

#### Scenario: ComponentId accepts new ids

- GIVEN the type system or runtime validates a ComponentId
- WHEN `"opencode-event-sounds"` or `"sdd-integration"` is provided
- THEN `"opencode-event-sounds"` is resolved to `"plugin"` and `"sdd-integration"` is accepted as valid

### Requirement: Plugin Component Install

The system SHALL copy `cyberpunk.ts` to `~/.config/opencode/plugins/cyberpunk.ts` under the `plugin` component id. Install MUST NOT patch `sdd-phase-common.md`. Section E/F patching is owned by `sdd-integration`.

(Previously: Plugin install also patched sdd-phase-common.md with Section E/F.)

#### Scenario: Plugin install without SDD patching

- GIVEN `sdd-phase-common.md` exists without markers
- WHEN `opencode-event-sounds` (or alias `plugin`) install runs
- THEN the plugin file is copied but `sdd-phase-common.md` is NOT modified

### Requirement: Backward Compatibility Alias

Existing configs referencing `plugin` as a ComponentId MUST be transparently resolved. No user action SHALL be required for old configs to function.

#### Scenario: Config with old id works

- GIVEN a cyberpunk config file contains `components.plugin.installed: true`
- WHEN the system reads the config
- THEN `plugin` is resolved normally and operations proceed (no migration needed)

### Requirement: Old Preset Migration

When a user specifies an old preset name, the system MUST resolve to the nearest new preset, emit a one-time deprecation warning, and proceed with install.

#### Scenario: Old wsl preset migrates

- GIVEN `--preset wsl` is specified on a WSL platform
- WHEN preset resolution runs
- THEN components map to nearest equivalent and warning mentions the new preset name
